"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui";
import { contactName, formatDate } from "@/lib/utils";
import {
  createContact,
  deleteContact,
  importContactsCsv,
  importPastedEmails,
  updateContactStatus,
  type ImportResult,
} from "./actions";
import type { ContactStatus } from "@prisma/client";

type Contact = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: ContactStatus;
  createdAt: Date;
  _count: { memberships: number };
};

type List = { id: string; name: string };

export default function ContactsClient({
  contacts,
  lists,
  total,
  page,
  pageSize,
  query,
}: {
  contacts: Contact[];
  lists: List[];
  total: number;
  page: number;
  pageSize: number;
  query: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importMode, setImportMode] = useState<"file" | "paste">("file");
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [search, setSearch] = useState(query);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Debounced server-side search: navigate when the input settles.
  useEffect(() => {
    if (search === query) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      router.push(`/contacts${params.toString() ? `?${params}` : ""}`);
    }, 400);
    return () => clearTimeout(t);
  }, [search, query, router]);

  function gotoPage(p: number) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (p > 1) params.set("page", String(p));
    router.push(`/contacts${params.toString() ? `?${params}` : ""}`);
  }

  function reportImport(res: ImportResult) {
    setImportResult(
      `Added ${res.created} new contact${res.created === 1 ? "" : "s"}` +
        (res.existing ? `, ${res.existing} already existed` : "") +
        (res.invalid ? `, ${res.invalid} invalid skipped` : "") +
        "."
    );
  }

  async function onAdd(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createContact(formData);
      if (res?.error) setError(res.error);
      else {
        setShowAdd(false);
        router.refresh();
      }
    });
  }

  async function onImportFile(formData: FormData) {
    const file = formData.get("file") as File;
    const listId = String(formData.get("listId") || "") || null;
    if (!file || file.size === 0) {
      setError("Choose a CSV file first.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError("That CSV is over 4 MB. Please split it into smaller files, or paste the emails instead.");
      return;
    }
    setError(null);
    const text = await file.text();
    setImportResult(null);
    startTransition(async () => {
      const res = await importContactsCsv(text, listId);
      if (res?.ok) {
        reportImport(res);
        router.refresh();
      }
    });
  }

  async function onImportPaste(formData: FormData) {
    const text = String(formData.get("emails") || "");
    const listId = String(formData.get("listId") || "") || null;
    if (!text.trim()) {
      setError("Paste some email addresses first.");
      return;
    }
    setError(null);
    setImportResult(null);
    startTransition(async () => {
      const res = await importPastedEmails(text, listId);
      if (res?.ok) {
        reportImport(res);
        router.refresh();
      }
    });
  }

  function setStatus(id: string, status: ContactStatus) {
    startTransition(async () => {
      await updateContactStatus(id, status);
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this contact permanently?")) return;
    startTransition(async () => {
      await deleteContact(id);
      router.refresh();
    });
  }

  const listSelect = (
    <div>
      <label className="label">Add imported contacts to a list (optional)</label>
      <select name="listId" className="input sm:max-w-xs">
        <option value="">— None —</option>
        {lists.map((l) => (
          <option key={l.id} value={l.id}>{l.name}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          className="input max-w-xs"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="ml-auto flex gap-2">
          <button className="btn-secondary" onClick={() => { setShowImport((v) => !v); setShowAdd(false); setError(null); }}>
            Import
          </button>
          <button className="btn-primary" onClick={() => { setShowAdd((v) => !v); setShowImport(false); setError(null); }}>
            Add contact
          </button>
        </div>
      </div>

      {showAdd && (
        <form action={onAdd} className="card mb-4 grid gap-3 p-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Email *</label>
            <input name="email" type="email" className="input" required />
          </div>
          <div>
            <label className="label">First name</label>
            <input name="firstName" className="input" />
          </div>
          <div>
            <label className="label">Last name</label>
            <input name="lastName" className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Add to list (optional)</label>
            <select name="listId" className="input">
              <option value="">— None —</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
          <div className="flex gap-2 sm:col-span-2">
            <button className="btn-primary" disabled={pending}>Save contact</button>
            <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </form>
      )}

      {showImport && (
        <div className="card mb-4 p-4">
          <div className="mb-4 inline-flex rounded-lg border border-slate-200 p-0.5">
            <button
              onClick={() => { setImportMode("file"); setError(null); }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${importMode === "file" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              Upload CSV
            </button>
            <button
              onClick={() => { setImportMode("paste"); setError(null); }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${importMode === "paste" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              Paste emails
            </button>
          </div>

          {importMode === "file" ? (
            <form action={onImportFile} className="space-y-4">
              <label
                htmlFor="csv-file"
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center transition-colors hover:border-indigo-400 hover:bg-indigo-50/40"
              >
                <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-lg">📄</span>
                <span className="text-sm font-medium text-indigo-700">
                  {fileName ? fileName : "Click to choose a CSV file"}
                </span>
                <span className="mt-1 text-xs text-slate-500">
                  Needs an <code className="rounded bg-slate-100 px-1">email</code> column;{" "}
                  <code className="rounded bg-slate-100 px-1">first_name</code> /{" "}
                  <code className="rounded bg-slate-100 px-1">last_name</code> optional. Up to 4 MB.
                </span>
                <input
                  id="csv-file"
                  name="file"
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
                />
              </label>
              {listSelect}
              {error && <p className="text-sm text-red-600">{error}</p>}
              {importResult && <p className="text-sm text-green-700">{importResult}</p>}
              <div className="flex gap-2">
                <button className="btn-primary" disabled={pending}>{pending ? "Importing…" : "Import file"}</button>
                <button type="button" className="btn-secondary" onClick={() => setShowImport(false)}>Close</button>
              </div>
            </form>
          ) : (
            <form action={onImportPaste} className="space-y-4">
              <div>
                <label className="label">Paste email addresses</label>
                <textarea
                  name="emails"
                  rows={8}
                  className="input font-mono text-xs"
                  placeholder={"ada@example.com, alan@example.com\ngrace@example.com\nJane Doe <jane@example.com>"}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Separate with commas, spaces, or new lines. Duplicates and invalid entries are skipped automatically.
                </p>
              </div>
              {listSelect}
              {error && <p className="text-sm text-red-600">{error}</p>}
              {importResult && <p className="text-sm text-green-700">{importResult}</p>}
              <div className="flex gap-2">
                <button className="btn-primary" disabled={pending}>{pending ? "Importing…" : "Import emails"}</button>
                <button type="button" className="btn-secondary" onClick={() => setShowImport(false)}>Close</button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Lists</th>
              <th className="px-4 py-3">Added</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {contacts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  {query ? "No contacts match your search." : "No contacts yet."}
                </td>
              </tr>
            )}
            {contacts.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{contactName(c) || "—"}</td>
                <td className="px-4 py-3 text-slate-600">{c.email}</td>
                <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                <td className="px-4 py-3 text-slate-600">{c._count.memberships}</td>
                <td className="px-4 py-3 text-slate-500">{formatDate(c.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {c.status === "SUBSCRIBED" ? (
                      <button className="text-xs text-slate-500 hover:text-slate-900" onClick={() => setStatus(c.id, "UNSUBSCRIBED")}>
                        Unsubscribe
                      </button>
                    ) : (
                      <button className="text-xs text-green-600 hover:text-green-800" onClick={() => setStatus(c.id, "SUBSCRIBED")}>
                        Resubscribe
                      </button>
                    )}
                    <button className="text-xs text-red-500 hover:text-red-700" onClick={() => remove(c.id)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-slate-500">
            Page {page} of {totalPages} · {total} contacts
          </span>
          <div className="flex gap-2">
            <button className="btn-secondary" disabled={page <= 1 || pending} onClick={() => gotoPage(page - 1)}>
              ← Prev
            </button>
            <button className="btn-secondary" disabled={page >= totalPages || pending} onClick={() => gotoPage(page + 1)}>
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
