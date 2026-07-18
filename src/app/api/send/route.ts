import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "@/lib/db";
import { sendJobSchema, deduplicateRecipients } from "@/lib/validators";
import { startSendJob } from "@/lib/sender";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = sendJobSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { subject, from_name, from_address, reply_to, html, recipients, rate_config } = parsed.data;

    const { valid, invalid } = deduplicateRecipients(recipients);

    const db = getDb();
    const suppressedEmails = new Set(
      (db.prepare("SELECT email FROM suppression").all() as { email: string }[]).map((r) => r.email)
    );

    const filtered = valid.filter((r) => !suppressedEmails.has(r.email));
    const suppressed = valid.length - filtered.length;

    if (filtered.length === 0) {
      return NextResponse.json(
        { error: "No valid recipients after deduplication and suppression filtering" },
        { status: 400 }
      );
    }

    const jobId = uuidv4();
    const rateConfigFinal = rate_config ?? {
      target_rate: 600,
      max_requests_per_sec: 1.5,
      batch_size: 100,
      max_retries: 3,
    };

    db.prepare(
      "INSERT INTO send_job (id, subject, from_name, from_address, reply_to, html, rate_config, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(jobId, subject, from_name, from_address, reply_to ?? null, html, JSON.stringify(rateConfigFinal), filtered.length);

    const insertRecipient = db.prepare(
      "INSERT INTO recipient_result (id, job_id, email, merge_data, batch_index) VALUES (?, ?, ?, ?, ?)"
    );

    const insertMany = db.transaction((recipients: typeof filtered) => {
      recipients.forEach((r, i) => {
        insertRecipient.run(uuidv4(), jobId, r.email, r.merge_data ? JSON.stringify(r.merge_data) : null, i);
      });
    });
    insertMany(filtered);

    startSendJob(jobId).catch(console.error);

    return NextResponse.json({
      job_id: jobId,
      total: filtered.length,
      invalid: invalid.length,
      suppressed,
      invalid_emails: invalid,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  const db = getDb();
  const jobs = db.prepare("SELECT id, subject, from_address, status, total, sent, failed, created_at FROM send_job ORDER BY created_at DESC LIMIT 50").all();
  return NextResponse.json({ jobs });
}
