import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { testSendSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = testSendSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { to, subject, from_name, from_address, reply_to, html } = parsed.data;
    const resend = new Resend(process.env.RESEND_API_KEY);

    const { data, error } = await resend.emails.send({
      from: `${from_name} <${from_address}>`,
      to: [to],
      subject: `[TEST] ${subject}`,
      html,
      replyTo: reply_to,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message_id: data?.id });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to send test email" }, { status: 500 });
  }
}
