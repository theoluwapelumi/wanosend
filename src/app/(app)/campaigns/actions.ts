"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { sendEmail, formatFrom, mailerIsLive } from "@/lib/mailer";
import { rewriteBase64Images, htmlHasBase64Image } from "@/lib/cloudinary";
import { renderMergeTags, withUnsubscribeFooter } from "@/lib/utils";
import { CampaignStatus, MessageStatus } from "@prisma/client";

async function guard() {
  const session = await requireApiUser();
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function createCampaign(formData: FormData) {
  const session = await guard();
  const name = String(formData.get("name") || "").trim();
  const subject = String(formData.get("subject") || "").trim();
  const fromName = String(formData.get("fromName") || "").trim();
  const fromEmail = String(formData.get("fromEmail") || "").trim();
  const html = String(formData.get("html") || "");
  const listId = String(formData.get("listId") || "").trim() || null;

  if (!name || !subject || !fromEmail || !html.trim()) {
    return { error: "Name, subject, from email, and body are required." };
  }

  const campaign = await prisma.campaign.create({
    data: {
      name,
      subject,
      fromName: fromName || fromEmail,
      fromEmail,
      html,
      listId,
      authorId: session.userId,
    },
  });
  revalidatePath("/campaigns");
  redirect(`/campaigns/${campaign.id}`);
}

export async function updateCampaign(id: string, formData: FormData) {
  await guard();
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) return { error: "Campaign not found." };
  if (campaign.status === "SENT" || campaign.status === "SENDING") {
    return { error: "You can't edit a campaign that has already been sent." };
  }

  const name = String(formData.get("name") || "").trim();
  const subject = String(formData.get("subject") || "").trim();
  const fromName = String(formData.get("fromName") || "").trim();
  const fromEmail = String(formData.get("fromEmail") || "").trim();
  const html = String(formData.get("html") || "");
  const listId = String(formData.get("listId") || "").trim() || null;

  if (!name || !subject || !fromEmail || !html.trim()) {
    return { error: "Name, subject, from email, and body are required." };
  }

  await prisma.campaign.update({
    where: { id },
    data: { name, subject, fromName: fromName || fromEmail, fromEmail, html, listId },
  });
  revalidatePath(`/campaigns/${id}`);
  return { ok: true };
}

export async function deleteCampaign(id: string) {
  await guard();
  await prisma.campaign.delete({ where: { id } });
  revalidatePath("/campaigns");
  redirect("/campaigns");
}

/**
 * Send a campaign to every subscribed contact in its list.
 * Creates a Message row per recipient and dispatches through Resend
 * (or dry-run when no API key is configured).
 */
export async function sendCampaign(id: string) {
  await guard();
  const appUrl = process.env.APP_URL || "http://localhost:3000";

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      list: {
        include: {
          memberships: { include: { contact: true } },
        },
      },
    },
  });

  if (!campaign) return { error: "Campaign not found." };
  if (!campaign.list) return { error: "Attach a list before sending." };
  if (campaign.status === "SENT" || campaign.status === "SENDING") {
    return { error: "This campaign has already been sent." };
  }

  const recipients = campaign.list.memberships
    .map((m) => m.contact)
    .filter((c) => c.status === "SUBSCRIBED");

  if (recipients.length === 0) {
    return { error: "No subscribed contacts in the selected list." };
  }

  await prisma.campaign.update({ where: { id }, data: { status: CampaignStatus.SENDING } });

  // Safety net: host any inline base64 images (Gmail blocks data: URIs and
  // clips oversized HTML). Rewrite once and persist the cleaned HTML.
  let campaignHtml = campaign.html;
  if (htmlHasBase64Image(campaignHtml)) {
    const rewritten = await rewriteBase64Images(campaignHtml);
    if (rewritten.replaced > 0) {
      campaignHtml = rewritten.html;
      await prisma.campaign.update({ where: { id }, data: { html: campaignHtml } });
    }
  }

  let sent = 0;
  let failed = 0;

  for (const contact of recipients) {
    const vars = {
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
    };
    const unsubUrl = `${appUrl}/unsubscribe/${contact.unsubToken}`;
    const html = withUnsubscribeFooter(renderMergeTags(campaignHtml, vars), unsubUrl);
    const subject = renderMergeTags(campaign.subject, vars);

    const message = await prisma.message.create({
      data: {
        campaignId: campaign.id,
        contactId: contact.id,
        email: contact.email,
        status: MessageStatus.QUEUED,
      },
    });

    const result = await sendEmail({
      from: formatFrom(campaign.fromName, campaign.fromEmail),
      to: contact.email,
      subject,
      html,
      headers: { "List-Unsubscribe": `<${unsubUrl}>` },
    });

    if (result.ok) {
      sent++;
      await prisma.message.update({
        where: { id: message.id },
        data: { status: MessageStatus.SENT, providerId: result.id, sentAt: new Date() },
      });
    } else {
      failed++;
      await prisma.message.update({
        where: { id: message.id },
        data: { status: MessageStatus.FAILED, error: result.error },
      });
    }
  }

  await prisma.campaign.update({
    where: { id },
    data: {
      status: failed === recipients.length ? CampaignStatus.FAILED : CampaignStatus.SENT,
      sentAt: new Date(),
    },
  });

  revalidatePath(`/campaigns/${id}`);
  revalidatePath("/campaigns");
  return { ok: true, sent, failed, dryRun: !mailerIsLive };
}

/** Send a single test email of the campaign to an arbitrary address. */
export async function sendTestEmail(id: string, testEmail: string) {
  await guard();
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) return { error: "Campaign not found." };
  if (!testEmail || !testEmail.includes("@")) return { error: "Enter a valid test email." };

  let campaignHtml = campaign.html;
  if (htmlHasBase64Image(campaignHtml)) {
    const rewritten = await rewriteBase64Images(campaignHtml);
    if (rewritten.replaced > 0) {
      campaignHtml = rewritten.html;
      await prisma.campaign.update({ where: { id }, data: { html: campaignHtml } });
    }
  }

  const vars = { firstName: "there", lastName: "", email: testEmail };
  const result = await sendEmail({
    from: formatFrom(campaign.fromName, campaign.fromEmail),
    to: testEmail,
    subject: "[TEST] " + renderMergeTags(campaign.subject, vars),
    html: renderMergeTags(campaignHtml, vars),
  });
  if (!result.ok) return { error: result.error };
  return { ok: true, dryRun: !mailerIsLive };
}
