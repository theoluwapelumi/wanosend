import { z } from "zod";

export const rateConfigSchema = z.object({
  target_rate: z.number().min(1).max(10000).default(600),
  max_requests_per_sec: z.number().min(0.1).max(2).default(1.5),
  batch_size: z.number().min(1).max(100).default(100),
  max_retries: z.number().min(1).max(10).default(3),
});

export const sendJobSchema = z.object({
  subject: z.string().min(1),
  from_name: z.string().min(1),
  from_address: z.string().email(),
  reply_to: z.string().email().optional(),
  html: z.string().min(1),
  // Emails are validated and de-duplicated by deduplicateRecipients (F4), so we
  // accept raw strings here rather than hard-rejecting a batch on one bad address.
  recipients: z.array(
    z.object({
      email: z.string(),
      merge_data: z.record(z.string(), z.string()).optional(),
    })
  ).min(1),
  rate_config: rateConfigSchema.optional(),
});

export const testSendSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  from_name: z.string().min(1),
  from_address: z.string().email(),
  reply_to: z.string().email().optional(),
  html: z.string().min(1),
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

export function deduplicateRecipients(
  recipients: { email: string; merge_data?: Record<string, string> }[]
): { valid: { email: string; merge_data?: Record<string, string> }[]; invalid: string[] } {
  const seen = new Set<string>();
  const valid: { email: string; merge_data?: Record<string, string> }[] = [];
  const invalid: string[] = [];

  for (const r of recipients) {
    const email = r.email.trim().toLowerCase();
    if (!validateEmail(email)) {
      invalid.push(r.email);
      continue;
    }
    if (seen.has(email)) continue;
    seen.add(email);
    valid.push({ ...r, email });
  }

  return { valid, invalid };
}
