import "server-only";
import { prisma, withDbRetry } from "@/lib/db";
import { sendEmail, formatFrom } from "@/lib/mailer";
import { rewriteBase64Images, htmlHasBase64Image } from "@/lib/cloudinary";
import { renderMergeTags, withUnsubscribeFooter } from "@/lib/utils";
import { CampaignStatus, MessageStatus, type Campaign } from "@prisma/client";

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const BATCH_SIZE = 25;
// Gentle pacing between sends (ms). ~8/sec by default; override with SEND_PACE_MS.
const PACE_MS = Number(process.env.SEND_PACE_MS ?? 120);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRateLimited(error?: string): boolean {
  if (!error) return false;
  const e = error.toLowerCase();
  return e.includes("rate") || e.includes("429") || e.includes("too many") || e.includes("quota");
}

type EnqueueResult = { queued: number; recipients: number } | { error: string };

/**
 * Ensure a QUEUED Message row exists for every subscribed recipient of the
 * campaign's list, and mark the campaign SENDING. Idempotent: contacts that
 * already have a message (queued/sent/failed) are skipped, so this can be
 * called repeatedly to (re)start or recover a send without double-sending.
 */
export async function enqueueCampaign(campaignId: string): Promise<EnqueueResult> {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return { error: "Campaign not found." };
  if (!campaign.listId) return { error: "Attach a list before sending." };
  if (campaign.status === CampaignStatus.SENT) {
    return { error: "This campaign has already been sent." };
  }

  // Host inline base64 images once, up front (cheap no-op after the first pass).
  if (htmlHasBase64Image(campaign.html)) {
    const r = await rewriteBase64Images(campaign.html);
    if (r.replaced > 0) {
      await prisma.campaign.update({ where: { id: campaignId }, data: { html: r.html } });
    }
  }

  const memberships = await prisma.listMembership.findMany({
    where: { listId: campaign.listId, contact: { status: "SUBSCRIBED" } },
    select: { contactId: true, contact: { select: { email: true } } },
  });
  if (memberships.length === 0) return { error: "No subscribed contacts in the selected list." };

  const rows = memberships.map((m) => ({
    campaignId,
    contactId: m.contactId,
    email: m.contact.email,
    status: MessageStatus.QUEUED,
  }));

  let queued = 0;
  const CHUNK = 1000;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const res = await prisma.message.createMany({
      data: rows.slice(i, i + CHUNK),
      skipDuplicates: true, // relies on @@unique([campaignId, contactId])
    });
    queued += res.count;
  }

  await prisma.campaign.update({ where: { id: campaignId }, data: { status: CampaignStatus.SENDING } });
  return { queued, recipients: memberships.length };
}

/** Send the next QUEUED messages for one campaign until the deadline or none remain. */
async function processCampaignMessages(campaign: Campaign, deadline: number): Promise<number> {
  const from = formatFrom(campaign.fromName, campaign.fromEmail);

  while (Date.now() < deadline) {
    const batch = await withDbRetry(() =>
      prisma.message.findMany({
        where: { campaignId: campaign.id, status: MessageStatus.QUEUED },
        take: BATCH_SIZE,
        include: { contact: true },
      })
    );
    if (batch.length === 0) break;

    for (const m of batch) {
      const c = m.contact;
      const vars = { firstName: c?.firstName ?? null, lastName: c?.lastName ?? null, email: m.email };
      const unsubUrl = c ? `${APP_URL}/unsubscribe/${c.unsubToken}` : APP_URL;
      const html = withUnsubscribeFooter(renderMergeTags(campaign.html, vars), unsubUrl);
      const subject = renderMergeTags(campaign.subject, vars);

      // Idempotency key = message id: a retry after a crash reuses the original
      // Resend send rather than delivering twice.
      const result = await sendEmail(
        { from, to: m.email, subject, html, headers: { "List-Unsubscribe": `<${unsubUrl}>` } },
        `msg_${m.id}`
      );

      if (result.ok) {
        await prisma.message.update({
          where: { id: m.id },
          data: { status: MessageStatus.SENT, providerId: result.id, sentAt: new Date(), error: null },
        });
      } else if (isRateLimited(result.error)) {
        // Throttled: leave this one QUEUED so a later cycle retries it, back
        // off briefly, and end this run (the worker will pick up where it left).
        await sleep(3000);
        return prisma.message.count({ where: { campaignId: campaign.id, status: MessageStatus.QUEUED } });
      } else {
        await prisma.message.update({
          where: { id: m.id },
          data: { status: MessageStatus.FAILED, error: result.error },
        });
      }

      if (Date.now() >= deadline) break;
      if (PACE_MS > 0) await sleep(PACE_MS);
    }
  }

  const remaining = await prisma.message.count({
    where: { campaignId: campaign.id, status: MessageStatus.QUEUED },
  });

  if (remaining === 0) {
    const delivered = await prisma.message.count({
      where: {
        campaignId: campaign.id,
        status: { in: [MessageStatus.SENT, MessageStatus.DELIVERED, MessageStatus.OPENED, MessageStatus.CLICKED] },
      },
    });
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: delivered > 0 ? CampaignStatus.SENT : CampaignStatus.FAILED, sentAt: new Date() },
    });
  }

  return remaining;
}

/**
 * Process every campaign currently in SENDING within a time budget. Reconciles
 * any campaign that is under-enqueued first (recovers sends interrupted before
 * all recipients were queued). Returns how many messages remain queued.
 */
export async function processSendingCampaigns(budgetMs = 45000): Promise<{ remaining: number }> {
  const deadline = Date.now() + budgetMs;
  const campaigns = await withDbRetry(() =>
    prisma.campaign.findMany({
      where: { status: CampaignStatus.SENDING },
      orderBy: { createdAt: "asc" },
    })
  );

  let remaining = 0;
  for (const campaign of campaigns) {
    if (!campaign.listId) continue;

    // Recover interrupted/legacy sends: ensure every recipient has a message.
    const [msgCount, subCount] = await Promise.all([
      prisma.message.count({ where: { campaignId: campaign.id } }),
      prisma.listMembership.count({ where: { listId: campaign.listId, contact: { status: "SUBSCRIBED" } } }),
    ]);
    if (msgCount < subCount) await enqueueCampaign(campaign.id);

    remaining += await processCampaignMessages(campaign, deadline);
    if (Date.now() >= deadline) break;
  }

  return { remaining };
}

/** Fire the cron/send endpoint so processing starts (or continues) promptly. */
export async function kickProcessor(): Promise<void> {
  const url = `${APP_URL}/api/cron/send`;
  const headers: Record<string, string> = {};
  if (process.env.CRON_SECRET) headers.authorization = `Bearer ${process.env.CRON_SECRET}`;
  try {
    await fetch(url, { headers, cache: "no-store" });
  } catch {
    // Best-effort: the Vercel cron schedule is the safety net.
  }
}
