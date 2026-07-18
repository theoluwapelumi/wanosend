"use client";

import { useEffect, useState } from "react";

type Suppression = { email: string; reason: string; created_at: string };

export function SuppressionList() {
  const [list, setList] = useState<Suppression[]>([]);
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("unsubscribe");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/suppression");
    if (res.ok) setList((await res.json()).suppressions);
  };

  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    setError(null);
    const res = await fetch("/api/suppression", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, reason }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to add");
      return;
    }
    setEmail("");
    load();
  };

  const remove = async (e: string) => {
    await fetch(`/api/suppression?email=${encodeURIComponent(e)}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="text-sm text-foreground/60 mb-4">
          Suppressed addresses are automatically excluded from every send. Hard bounces and
          unsubscribes belong here to keep bounce rate under Resend&apos;s 4% threshold.
        </p>

        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="bounced@example.com"
              className="w-full px-3 py-2 rounded-lg border border-foreground/20 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-foreground/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="px-3 py-2 rounded-lg border border-foreground/20 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-foreground/30"
            >
              <option value="unsubscribe">Unsubscribe</option>
              <option value="bounce">Bounce</option>
              <option value="manual">Manual</option>
            </select>
          </div>
          <button
            onClick={add}
            disabled={!email}
            className="px-4 py-2 text-sm font-medium border border-foreground/20 rounded-lg hover:bg-foreground/5 disabled:opacity-40"
          >
            Add
          </button>
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</p>}
      </div>

      <div className="border border-foreground/10 rounded-lg overflow-hidden">
        {list.length === 0 ? (
          <p className="p-4 text-sm text-foreground/50">No suppressed addresses yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-foreground/10 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Reason</th>
                <th className="px-3 py-2 font-medium">Added</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.email} className="border-b border-foreground/5">
                  <td className="px-3 py-2 font-mono">{s.email}</td>
                  <td className="px-3 py-2 capitalize">{s.reason}</td>
                  <td className="px-3 py-2 text-foreground/50">{s.created_at}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => remove(s.email)}
                      className="text-xs text-red-600 dark:text-red-400 underline"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
