"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { sendEmail, formatFrom, mailerIsLive } from "@/lib/mailer";
import { rewriteBase64Images, htmlHasBase64Image } from "@/lib/cloudinary";
import { renderMergeTags } from "@/lib/utils";
import { enqueueCampaign, kickProcessor } from "@/lib/send-engine";

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
 * Start (or resume) sending a campaign. Enqueues a QUEUED message for every
 * subscribed recipient and kicks the background worker — returns immediately so
 * the request never times out on large sends. The worker processes in batches,
 * skips anyone already sent, and self-continues; a cron also drains any
 * SENDING campaign, so an interrupted send resumes on its own.
 */
export async function sendCampaign(id: string) {
  await guard();

  const res = await enqueueCampaign(id);
  if ("error" in res) return { error: res.error };

  revalidatePath(`/campaigns/${id}`);
  revalidatePath("/campaigns");

  // Start processing after the response is sent (Vercel keeps the function
  // alive for `after`); the worker self-chains until the queue drains.
  after(() => kickProcessor());

  return { ok: true, queued: res.queued, recipients: res.recipients, dryRun: !mailerIsLive };
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
