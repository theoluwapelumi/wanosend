import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { MessageStatus } from "@prisma/client";

/**
 * Resend webhook receiver. Maps Resend email.* events onto Message rows
 * (matched by providerId) and updates contact status on bounce/complaint.
 *
 * Configure the endpoint in the Resend dashboard as:
 *   {APP_URL}/api/webhooks/resend
 * Signature verification via RESEND_WEBHOOK_SECRET (Svix) can be added here.
 */

const EVENT_TO_STATUS: Record<string, MessageStatus> = {
  "email.sent": MessageStatus.SENT,
  "email.delivered": MessageStatus.DELIVERED,
  "email.opened": MessageStatus.OPENED,
  "email.clicked": MessageStatus.CLICKED,
  "email.bounced": MessageStatus.BOUNCED,
  "email.complained": MessageStatus.COMPLAINED,
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.type !== "string") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const type: string = body.type;
  const emailId: string | undefined = body?.data?.email_id ?? body?.data?.id;
  const status = EVENT_TO_STATUS[type];

  if (!status || !emailId) {
    // Unknown event type or missing id — acknowledge so Resend stops retrying.
    return NextResponse.json({ ok: true, ignored: true });
  }

  const message = await prisma.message.findFirst({ where: { providerId: emailId } });
  if (!message) return NextResponse.json({ ok: true, unmatched: true });

  const now = new Date();
  await prisma.message.update({
    where: { id: message.id },
    data: {
      status,
      openedAt: type === "email.opened" ? now : undefined,
      clickedAt: type === "email.clicked" ? now : undefined,
    },
  });

  // Propagate hard signals to the contact record.
  if ((type === "email.bounced" || type === "email.complained") && message.contactId) {
    await prisma.contact.update({
      where: { id: message.contactId },
      data: { status: type === "email.bounced" ? "BOUNCED" : "COMPLAINED" },
    });
  }

  return NextResponse.json({ ok: true });
}
