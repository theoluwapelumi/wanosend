"use client";

import { useState } from "react";
import { HtmlEditor } from "@/components/HtmlEditor";
import { RecipientInput } from "@/components/RecipientInput";
import { ImageUploader } from "@/components/ImageUploader";
import { RateConfigPanel } from "@/components/RateConfig";
import { SendProgress } from "@/components/SendProgress";
import { SuppressionList } from "@/components/SuppressionList";

type Recipient = { email: string; merge_data?: Record<string, string> };
type RateConfigType = {
  target_rate: number;
  max_requests_per_sec: number;
  batch_size: number;
  max_retries: number;
};

type Tab = "compose" | "recipients" | "images" | "rate" | "send" | "suppression";

export default function Home() {
  const [tab, setTab] = useState<Tab>("compose");
  const [html, setHtml] = useState("");
  const [subject, setSubject] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromAddress, setFromAddress] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [invalidEmails, setInvalidEmails] = useState<string[]>([]);
  const [rateConfig, setRateConfig] = useState<RateConfigType>({
    target_rate: 600,
    max_requests_per_sec: 1.5,
    batch_size: 100,
    max_retries: 3,
  });
  const [jobId, setJobId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tabs: { key: Tab; label: string }[] = [
    { key: "compose", label: "Compose" },
    { key: "recipients", label: "Recipients" },
    { key: "images", label: "Images" },
    { key: "rate", label: "Rate Config" },
    { key: "send", label: "Send" },
    { key: "suppression", label: "Suppressions" },
  ];

  const handleTestSend = async () => {
    setError(null);
    const testEmail = prompt("Enter your email address for the test send:");
    if (!testEmail) return;
    setTestStatus("Sending test...");
    try {
      const res = await fetch("/api/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: testEmail,
          subject,
          from_name: fromName,
          from_address: fromAddress,
          reply_to: replyTo || undefined,
          html,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTestStatus(null);
        setError(typeof data.error === "string" ? data.error : "Test send failed");
      } else {
        setTestStatus(`Test sent to ${testEmail}. Message ID: ${data.message_id}`);
      }
    } catch {
      setTestStatus(null);
      setError("Failed to send test email");
    }
  };

  const handleSend = async () => {
    setError(null);
    if (!html || !subject || !fromName || !fromAddress) {
      setError("Fill in subject, from name, from address, and HTML content first.");
      return;
    }
    if (recipients.length === 0) {
      setError("No recipients loaded.");
      return;
    }

    const confirmed = confirm(
      `Send "${subject}" to ${recipients.length} recipients at ${rateConfig.target_rate} emails/min?`
    );
    if (!confirmed) return;

    setSending(true);
    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          from_name: fromName,
          from_address: fromAddress,
          reply_to: replyTo || undefined,
          html,
          recipients,
          rate_config: rateConfig,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
        setSending(false);
      } else {
        setJobId(data.job_id);
      }
    } catch {
      setError("Failed to start send job");
      setSending(false);
    }
  };

  const canSend = Boolean(html && subject && fromName && fromAddress && recipients.length > 0);

  return (
    <main className="max-w-6xl mx-auto p-4 sm:p-8 w-full">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">WanoSend</h1>
        <p className="text-sm text-foreground/60 mt-1">Paste HTML. Set rate. Send.</p>
      </header>

      <nav className="flex gap-1 border-b border-foreground/10 mb-6 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t.key
                ? "border-foreground text-foreground"
                : "border-transparent text-foreground/50 hover:text-foreground/80"
            }`}
          >
            {t.label}
            {t.key === "recipients" && recipients.length > 0 && (
              <span className="ml-1.5 text-xs bg-foreground/10 px-1.5 py-0.5 rounded-full">
                {recipients.length}
              </span>
            )}
          </button>
        ))}
      </nav>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-600 dark:text-red-400 text-sm flex justify-between gap-4">
          <span className="break-words">{error}</span>
          <button onClick={() => setError(null)} className="underline shrink-0">
            dismiss
          </button>
        </div>
      )}

      {testStatus && (
        <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-600 dark:text-green-400 text-sm">
          {testStatus}
        </div>
      )}

      <div className={tab === "compose" ? "" : "hidden"}>
        <div className="space-y-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Subject">
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject line — supports {{merge_tags}}"
                className={inputClass}
              />
            </Field>
            <Field label="Reply-To">
              <input
                type="email"
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
                placeholder="reply@example.com (optional)"
                className={inputClass}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="From Name">
              <input
                type="text"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Your Company"
                className={inputClass}
              />
            </Field>
            <Field label="From Address (verified domain)">
              <input
                type="email"
                value={fromAddress}
                onChange={(e) => setFromAddress(e.target.value)}
                placeholder="noreply@yourdomain.com"
                className={inputClass}
              />
            </Field>
          </div>
        </div>

        <HtmlEditor html={html} onChange={setHtml} />
      </div>

      <div className={tab === "recipients" ? "" : "hidden"}>
        <RecipientInput
          recipients={recipients}
          invalidEmails={invalidEmails}
          onUpdate={(valid, invalid) => {
            setRecipients(valid);
            setInvalidEmails(invalid);
          }}
        />
      </div>

      <div className={tab === "images" ? "" : "hidden"}>
        <ImageUploader />
      </div>

      <div className={tab === "rate" ? "" : "hidden"}>
        <RateConfigPanel config={rateConfig} onChange={setRateConfig} />
      </div>

      <div className={tab === "send" ? "" : "hidden"}>
        {jobId ? (
          <SendProgress
            jobId={jobId}
            onReset={() => {
              setJobId(null);
              setSending(false);
            }}
          />
        ) : (
          <div className="space-y-6">
            <div className="p-6 border border-foreground/10 rounded-lg">
              <h2 className="text-lg font-semibold mb-4">Send Summary</h2>
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
                <dt className="text-foreground/60">Subject</dt>
                <dd className="break-words">{subject || "—"}</dd>
                <dt className="text-foreground/60">From</dt>
                <dd className="break-words">
                  {fromName && fromAddress ? `${fromName} <${fromAddress}>` : "—"}
                </dd>
                <dt className="text-foreground/60">Reply-To</dt>
                <dd>{replyTo || "—"}</dd>
                <dt className="text-foreground/60">Recipients</dt>
                <dd>{recipients.length}</dd>
                <dt className="text-foreground/60">Target rate</dt>
                <dd>{rateConfig.target_rate} emails/min</dd>
                <dt className="text-foreground/60">Batch size</dt>
                <dd>{rateConfig.batch_size}</dd>
              </dl>
            </div>

            {!canSend && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Complete the compose fields and load recipients before sending.
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleTestSend}
                disabled={!html || !subject || !fromName || !fromAddress}
                className="px-4 py-2 text-sm font-medium border border-foreground/20 rounded-lg hover:bg-foreground/5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Send Test to Self
              </button>
              <button
                onClick={handleSend}
                disabled={!canSend || sending}
                className="px-6 py-2 text-sm font-medium bg-foreground text-background rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {sending ? "Starting…" : `Send to ${recipients.length} recipients`}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={tab === "suppression" ? "" : "hidden"}>
        <SuppressionList />
      </div>
    </main>
  );
}

const inputClass =
  "w-full px-3 py-2 rounded-lg border border-foreground/20 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-foreground/30";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {children}
    </div>
  );
}
