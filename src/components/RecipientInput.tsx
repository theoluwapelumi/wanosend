"use client";

import { useState, useRef } from "react";
import Papa from "papaparse";

type Recipient = { email: string; merge_data?: Record<string, string> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function dedupe(raw: Recipient[]): { valid: Recipient[]; invalid: string[] } {
  const seen = new Set<string>();
  const valid: Recipient[] = [];
  const invalid: string[] = [];
  for (const r of raw) {
    const email = r.email.trim().toLowerCase();
    if (!email) continue;
    if (!EMAIL_RE.test(email)) {
      invalid.push(r.email);
      continue;
    }
    if (seen.has(email)) continue;
    seen.add(email);
    valid.push({ ...r, email });
  }
  return { valid, invalid };
}

export function RecipientInput({
  recipients,
  invalidEmails,
  onUpdate,
}: {
  recipients: Recipient[];
  invalidEmails: string[];
  onUpdate: (valid: Recipient[], invalid: string[]) => void;
}) {
  const [pasteText, setPasteText] = useState("");
  const [mergeColumns, setMergeColumns] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePaste = () => {
    const parts = pasteText.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
    const raw = parts.map((email) => ({ email }));
    const { valid, invalid } = dedupe(raw);
    setMergeColumns([]);
    onUpdate(valid, invalid);
  };

  const handleCsv = (file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const fields = result.meta.fields || [];
        const emailField = fields.find((f) => f.toLowerCase().trim() === "email");
        if (!emailField) {
          onUpdate([], ["CSV must contain an 'email' column"]);
          return;
        }
        const cols = fields.filter((f) => f !== emailField);
        setMergeColumns(cols);

        const raw: Recipient[] = result.data.map((row) => {
          const merge_data: Record<string, string> = {};
          for (const c of cols) {
            if (row[c] !== undefined) merge_data[c] = row[c];
          }
          return { email: row[emailField] ?? "", merge_data };
        });

        const { valid, invalid } = dedupe(raw);
        onUpdate(valid, invalid);
      },
    });
  };

  const total = recipients.length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium mb-1">Paste addresses</label>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="alice@example.com, bob@example.com&#10;carol@example.com"
            className="w-full h-40 px-3 py-2 rounded-lg border border-foreground/20 bg-background text-foreground text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-foreground/30"
          />
          <button
            onClick={handlePaste}
            disabled={!pasteText.trim()}
            className="mt-2 px-4 py-2 text-sm font-medium border border-foreground/20 rounded-lg hover:bg-foreground/5 disabled:opacity-40"
          >
            Load pasted addresses
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Upload CSV</label>
          <div className="h-40 rounded-lg border border-dashed border-foreground/25 flex flex-col items-center justify-center gap-2 text-center p-4">
            <p className="text-sm text-foreground/60">
              CSV with an <code className="font-mono">email</code> column plus optional merge columns.
            </p>
            <button
              onClick={() => fileRef.current?.click()}
              className="px-4 py-2 text-sm font-medium border border-foreground/20 rounded-lg hover:bg-foreground/5"
            >
              Choose CSV file
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleCsv(f);
                e.target.value = "";
              }}
            />
          </div>
        </div>
      </div>

      {(total > 0 || invalidEmails.length > 0) && (
        <div className="p-4 border border-foreground/10 rounded-lg space-y-3">
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="font-medium text-green-600 dark:text-green-400">
              {total} valid & de-duplicated
            </span>
            {invalidEmails.length > 0 && (
              <span className="font-medium text-red-600 dark:text-red-400">
                {invalidEmails.length} invalid/skipped
              </span>
            )}
            {mergeColumns.length > 0 && (
              <span className="text-foreground/60">
                Merge columns: {mergeColumns.map((c) => `{{${c}}}`).join(", ")}
              </span>
            )}
          </div>

          {invalidEmails.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-foreground/60">Show skipped entries</summary>
              <div className="mt-2 max-h-32 overflow-auto font-mono text-red-600 dark:text-red-400">
                {invalidEmails.map((e, i) => (
                  <div key={i}>{e}</div>
                ))}
              </div>
            </details>
          )}

          {total > 0 && (
            <div className="max-h-48 overflow-auto text-xs font-mono border-t border-foreground/10 pt-2">
              {recipients.slice(0, 200).map((r, i) => (
                <div key={i} className="flex justify-between py-0.5">
                  <span>{r.email}</span>
                  {r.merge_data && Object.keys(r.merge_data).length > 0 && (
                    <span className="text-foreground/40">
                      {Object.entries(r.merge_data)
                        .map(([k, v]) => `${k}=${v}`)
                        .join(" ")}
                    </span>
                  )}
                </div>
              ))}
              {total > 200 && (
                <div className="text-foreground/40 pt-1">…and {total - 200} more</div>
              )}
            </div>
          )}

          <button
            onClick={() => {
              setPasteText("");
              setMergeColumns([]);
              onUpdate([], []);
            }}
            className="text-xs text-foreground/50 underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
