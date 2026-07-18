"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCampaign, sendCampaign, sendTestEmail } from "../actions";

export default function CampaignActions({
  id,
  status,
  recipientCount,
  sentCount,
  queuedCount,
  mailerLive,
}: {
  id: string;
  status: string;
  recipientCount: number;
  sentCount: number;
  queuedCount: number;
  mailerLive: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("");

  const isSending = status === "SENDING";

  // While a send is in progress, poll for updated progress.
  useEffect(() => {
    if (!isSending) return;
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [isSending, router]);

  function doSend(resume = false) {
    setErr(null);
    setMsg(null);
    const prompt = resume
      ? "Resume sending the remaining contacts?"
      : `Send this campaign to ${recipientCount} subscribed contact(s)?`;
    if (!confirm(prompt)) return;
    startTransition(async () => {
      const res = await sendCampaign(id);
      if (res?.error) setErr(res.error);
      else {
        setMsg(
          `${res.dryRun ? "Dry-run: " : ""}${res.queued} email(s) queued — sending in the background.`
        );
        router.refresh();
      }
    });
  }

  function doTest() {
    setErr(null);
    setMsg(null);
    startTransition(async () => {
      const res = await sendTestEmail(id, testEmail);
      if (res?.error) setErr(res.error);
      else setMsg(`${res.dryRun ? "Dry-run: " : ""}Test email sent to ${testEmail}.`);
    });
  }

  function doDelete() {
    if (!confirm("Delete this campaign and its send history?")) return;
    startTransition(async () => {
      await deleteCampaign(id);
    });
  }

  const progressPct =
    recipientCount > 0 ? Math.min(100, Math.round((sentCount / recipientCount) * 100)) : 0;

  return (
    <div className="card p-5">
      {!mailerLive && (
        <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Dry-run mode: no <code>RESEND_API_KEY</code> configured. Sends are logged but not delivered.
        </div>
      )}

      {isSending && (
        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
            <span>Sending… {sentCount} of {recipientCount}</span>
            <span>{queuedCount} queued</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {status === "DRAFT" ? (
          <button className="btn-primary" onClick={() => doSend(false)} disabled={pending || recipientCount === 0}>
            {pending ? "Queuing…" : `Send to ${recipientCount} contact(s)`}
          </button>
        ) : isSending ? (
          <button className="btn-secondary" onClick={() => doSend(true)} disabled={pending}>
            {pending ? "Working…" : "Resume / retry now"}
          </button>
        ) : status === "FAILED" ? (
          <button className="btn-primary" onClick={() => doSend(true)} disabled={pending || recipientCount === 0}>
            {pending ? "Queuing…" : "Retry send"}
          </button>
        ) : (
          <span className="text-sm text-slate-500">This campaign has been sent.</span>
        )}
        <button className="btn-danger ml-auto" onClick={doDelete} disabled={pending}>Delete</button>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <label className="label">Send a test email</label>
        <div className="flex gap-2">
          <input
            className="input"
            type="email"
            placeholder="you@example.com"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
          />
          <button className="btn-secondary shrink-0" onClick={doTest} disabled={pending || !testEmail}>
            Send test
          </button>
        </div>
      </div>

      {msg && <p className="mt-3 text-sm text-green-700">{msg}</p>}
      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
    </div>
  );
}
