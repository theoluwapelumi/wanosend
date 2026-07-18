import { Resend } from "resend";
import { getDb } from "./db";

function getResend(): Resend {
  return new Resend(process.env.RESEND_API_KEY);
}

interface RateConfig {
  target_rate: number;
  max_requests_per_sec: number;
  batch_size: number;
  max_retries: number;
}

interface RecipientRow {
  id: string;
  email: string;
  merge_data: string | null;
}

const activeJobs = new Map<string, { paused: boolean; cancelled: boolean }>();

export function getJobControl(jobId: string) {
  return activeJobs.get(jobId);
}

function resolveMergeTags(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? "");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function startSendJob(jobId: string) {
  const db = getDb();
  const job = db.prepare("SELECT * FROM send_job WHERE id = ?").get(jobId) as {
    id: string;
    subject: string;
    from_name: string;
    from_address: string;
    reply_to: string | null;
    html: string;
    rate_config: string;
  } | undefined;

  if (!job) throw new Error("Job not found");

  const rateConfig: RateConfig = JSON.parse(job.rate_config);
  const batchSize = Math.min(rateConfig.batch_size, 100);
  const maxReqPerSec = Math.min(rateConfig.max_requests_per_sec, 2);
  const intervalMs = 1000 / maxReqPerSec;

  const targetEmailsPerMin = rateConfig.target_rate;
  const targetBatchesPerMin = targetEmailsPerMin / batchSize;
  const targetIntervalMs = Math.max(intervalMs, (60 * 1000) / targetBatchesPerMin);

  const control = { paused: false, cancelled: false };
  activeJobs.set(jobId, control);

  db.prepare("UPDATE send_job SET status = 'sending' WHERE id = ?").run(jobId);

  const pendingRecipients = db
    .prepare("SELECT id, email, merge_data FROM recipient_result WHERE job_id = ? AND status = 'pending' ORDER BY batch_index")
    .all(jobId) as RecipientRow[];

  const batches: RecipientRow[][] = [];
  for (let i = 0; i < pendingRecipients.length; i += batchSize) {
    batches.push(pendingRecipients.slice(i, i + batchSize));
  }

  const updateRecipient = db.prepare(
    "UPDATE recipient_result SET status = ?, resend_message_id = ?, error = ?, attempts = attempts + 1, updated_at = datetime('now') WHERE id = ?"
  );
  const updateJobCounts = db.prepare(
    "UPDATE send_job SET sent = ?, failed = ? WHERE id = ?"
  );

  let totalSent = 0;
  let totalFailed = 0;

  const resend = getResend();

  for (const batch of batches) {
    if (control.cancelled) {
      db.prepare("UPDATE send_job SET status = 'cancelled' WHERE id = ?").run(jobId);
      activeJobs.delete(jobId);
      return;
    }

    while (control.paused) {
      await sleep(500);
      if (control.cancelled) {
        db.prepare("UPDATE send_job SET status = 'cancelled' WHERE id = ?").run(jobId);
        activeJobs.delete(jobId);
        return;
      }
    }

    const idempotencyKey = `${jobId}-batch-${batch[0].id}`;

    const emails = batch.map((r) => {
      const mergeData = r.merge_data ? JSON.parse(r.merge_data) : {};
      return {
        from: `${job.from_name} <${job.from_address}>`,
        to: [r.email],
        subject: resolveMergeTags(job.subject, mergeData),
        html: resolveMergeTags(job.html, mergeData),
        replyTo: job.reply_to || undefined,
        headers: {
          "List-Unsubscribe": `<mailto:${job.from_address}?subject=unsubscribe>`,
        },
      };
    });

    let attempt = 0;
    let success = false;

    while (attempt < rateConfig.max_retries && !success) {
      attempt++;
      try {
        const { data, error } = await resend.batch.send(emails, {
          idempotencyKey,
        });

        if (error) {
          throw new Error(error.message);
        }

        if (data && Array.isArray(data.data)) {
          for (let i = 0; i < batch.length; i++) {
            const result = data.data[i];
            if (result && "id" in result) {
              updateRecipient.run("sent", result.id, null, batch[i].id);
              totalSent++;
            } else {
              updateRecipient.run("failed", null, "No ID returned", batch[i].id);
              totalFailed++;
            }
          }
        }
        success = true;
      } catch (err: unknown) {
        const error = err as { statusCode?: number; message?: string };
        if (error.statusCode === 429 && attempt < rateConfig.max_retries) {
          const backoff = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
          await sleep(backoff);
          continue;
        }

        for (const r of batch) {
          updateRecipient.run("failed", null, String(error.message ?? err), r.id);
          totalFailed++;
        }
        success = true;
      }
    }

    updateJobCounts.run(totalSent, totalFailed, jobId);
    await sleep(targetIntervalMs);
  }

  db.prepare("UPDATE send_job SET status = 'completed' WHERE id = ?").run(jobId);
  activeJobs.delete(jobId);
}

export function pauseJob(jobId: string): boolean {
  const control = activeJobs.get(jobId);
  if (!control) return false;
  control.paused = true;
  getDb().prepare("UPDATE send_job SET status = 'paused' WHERE id = ?").run(jobId);
  return true;
}

export function resumeJob(jobId: string): boolean {
  const control = activeJobs.get(jobId);
  if (!control) return false;
  control.paused = false;
  getDb().prepare("UPDATE send_job SET status = 'sending' WHERE id = ?").run(jobId);
  return true;
}

export function cancelJob(jobId: string): boolean {
  const control = activeJobs.get(jobId);
  if (!control) return false;
  control.cancelled = true;
  return true;
}
