import "server-only";
import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;

/** Resend is only "live" when a real API key is configured. */
export const mailerIsLive = Boolean(apiKey && apiKey.startsWith("re_"));

const resend = mailerIsLive ? new Resend(apiKey) : null;

export type SendResult =
  | { ok: true; id: string; dryRun: boolean }
  | { ok: false; error: string };

export type SendEmailInput = {
  from: string; // "Name <email@domain>"
  to: string;
  subject: string;
  html: string;
  headers?: Record<string, string>;
};

/**
 * Send a single email through Resend. When no API key is configured the send
 * is a dry-run: it succeeds with a synthetic id so the platform is fully
 * usable/testable without live credentials.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendResult> {
  if (!resend) {
    return { ok: true, id: `dryrun_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, dryRun: true };
  }
  try {
    const { data, error } = await resend.emails.send({
      from: input.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      headers: input.headers,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id ?? "", dryRun: false };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown send error" };
  }
}

export function formatFrom(name: string, email: string) {
  return name ? `${name} <${email}>` : email;
}
