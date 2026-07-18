"use client";

import { useEffect, useState, useRef } from "react";

type JobStatus = {
  id: string;
  status: string;
  total: number;
  sent: number;
  failed: number;
  subject: string;
};

type Result = {
  email: string;
  status: string;
  resend_message_id: string | null;
  error: string | null;
  attempts: number;
};

export function SendProgress({ jobId, onReset }: { jobId: string; onReset: () => void }) {
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [throughput, setThroughput] = useState(0);
  const lastSent = useRef({ count: 0, time: Date.now() });

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/send/${jobId}/status`);
        if (!res.ok) return;
        const data: JobStatus = await res.json();
        if (!active) return;
        setStatus(data);

        const now = Date.now();
        const elapsed = (now - lastSent.current.time) / 1000;
        if (elapsed >= 1) {
          const delta = data.sent - lastSent.current.count;
          setThroughput(Math.max(0, Math.round((delta / elapsed) * 60)));
          lastSent.current = { count: data.sent, time: now };
        }

        if (["completed", "cancelled"].includes(data.status)) {
          const r = await fetch(`/api/send/${jobId}/results`);
          if (r.ok) setResults((await r.json()).results);
          return;
        }
      } catch {
        /* ignore transient poll errors */
      }
    };

    poll();
    const interval = setInterval(poll, 1000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [jobId]);

  const control = async (action: "pause" | "resume" | "cancel") => {
    await fetch(`/api/send/${jobId}/${action}`, { method: "POST" });
  };

  const loadResults = async () => {
    const r = await fetch(`/api/send/${jobId}/results`);
    if (r.ok) setResults((await r.json()).results);
  };

  const exportCsv = () => {
    const header = "email,status,resend_message_id,error,attempts";
    const rows = results.map(
      (r) =>
        `"${r.email}","${r.status}","${r.resend_message_id ?? ""}","${(r.error ?? "").replace(/"/g, '""')}","${r.attempts}"`
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wanosend-results-${jobId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!status) return <p className="text-sm text-foreground/60">Loading job status…</p>;

  const remaining = status.total - status.sent - status.failed;
  const pct = status.total > 0 ? Math.round(((status.sent + status.failed) / status.total) * 100) : 0;
  const isActive = ["sending", "paused"].includes(status.status);
  const isDone = ["completed", "cancelled"].includes(status.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">{status.subject}</h2>
          <p className="text-sm text-foreground/60">
            Job {jobId.slice(0, 8)} · <span className="capitalize">{status.status}</span>
          </p>
        </div>
        {isActive && (
          <div className="flex gap-2">
            {status.status === "sending" ? (
              <button
                onClick={() => control("pause")}
                className="px-3 py-1.5 text-sm border border-foreground/20 rounded-lg hover:bg-foreground/5"
              >
                Pause
              </button>
            ) : (
              <button
                onClick={() => control("resume")}
                className="px-3 py-1.5 text-sm border border-foreground/20 rounded-lg hover:bg-foreground/5"
              >
                Resume
              </button>
            )}
            <button
              onClick={() => control("cancel")}
              className="px-3 py-1.5 text-sm border border-red-500/40 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-500/5"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="w-full h-3 bg-foreground/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-foreground transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label="Sent" value={status.sent} accent="text-green-600 dark:text-green-400" />
        <Stat label="Failed" value={status.failed} accent="text-red-600 dark:text-red-400" />
        <Stat label="Remaining" value={remaining} />
        <Stat
          label="Throughput"
          value={isActive ? `${throughput}/min` : "—"}
        />
      </div>

      {isDone && (
        <div className="flex flex-wrap gap-3">
          <button
            onClick={loadResults}
            className="px-4 py-2 text-sm font-medium border border-foreground/20 rounded-lg hover:bg-foreground/5"
          >
            Load result log
          </button>
          <button
            onClick={exportCsv}
            disabled={results.length === 0}
            className="px-4 py-2 text-sm font-medium border border-foreground/20 rounded-lg hover:bg-foreground/5 disabled:opacity-40"
          >
            Export CSV
          </button>
          <button
            onClick={onReset}
            className="px-4 py-2 text-sm font-medium bg-foreground text-background rounded-lg hover:opacity-90"
          >
            New send
          </button>
        </div>
      )}

      {results.length > 0 && (
        <div className="border border-foreground/10 rounded-lg overflow-hidden">
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-background border-b border-foreground/10">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Message ID / Error</th>
                  <th className="px-3 py-2 font-medium">Attempts</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className="border-b border-foreground/5">
                    <td className="px-3 py-1.5 font-mono">{r.email}</td>
                    <td className="px-3 py-1.5">
                      <span
                        className={
                          r.status === "sent"
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 font-mono text-foreground/60 truncate max-w-xs">
                      {r.resend_message_id || r.error || "—"}
                    </td>
                    <td className="px-3 py-1.5">{r.attempts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="p-4 border border-foreground/10 rounded-lg">
      <p className="text-xs text-foreground/50 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${accent ?? ""}`}>{value}</p>
    </div>
  );
}
