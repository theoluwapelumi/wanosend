"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui";
import { contactName, formatDate } from "@/lib/utils";
import {
  createContact,
  deleteContact,
  importContactsCsv,
  updateContactStatus,
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
}: {
  contacts: Contact[];
  lists: List[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const filtered = contacts.filter((c) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      c.email.toLowerCase().includes(q) ||
      contactName(c).toLowerCase().includes(q)
    );
  });

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

  async function onImport(formData: FormData) {
    const file = formData.get("file") as File;
    const listId = String(formData.get("listId") || "") || null;
    if (!file || file.size === 0) {
      setError("Choose a CSV file first.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError("That CSV is over 4 MB. Please split it into smaller files and import them separately.");
      return;
    }
    const text = await file.text();
    setImportResult(null);
    startTransition(async () => {
      const res = await importContactsCsv(text, listId);
      if (res?.ok) {
        setImportResult(
          `Imported ${res.created}, skipped ${res.skipped}, invalid ${res.invalid}.`
        );
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

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          className="input max-w-xs"
          placeholder="Search by name or email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="ml-auto flex gap-2">
          <button className="btn-secondary" onClick={() => { setShowImport((v) => !v); setShowAdd(false); }}>
            Import CSV
          </button>
          <button className="btn-primary" onClick={() => { setShowAdd((v) => !v); setShowImport(false); }}>
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
        <form action={onImport} className="card mb-4 space-y-3 p-4">
          <p className="text-sm text-slate-600">
            Upload a CSV with an <code className="rounded bg-slate-100 px-1">email</code> column.
            Optional <code className="rounded bg-slate-100 px-1">first_name</code> and{" "}
            <code className="rounded bg-slate-100 px-1">last_name</code> columns are supported.
          </p>
          <input name="file" type="file" accept=".csv,text/csv" className="input" />
          <div>
            <label className="label">Add imported contacts to list (optional)</label>
            <select name="listId" className="input max-w-xs">
              <option value="">— None —</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {importResult && <p className="text-sm text-green-700">{importResult}</p>}
          <div className="flex gap-2">
            <button className="btn-primary" disabled={pending}>{pending ? "Importing…" : "Import"}</button>
            <button type="button" className="btn-secondary" onClick={() => setShowImport(false)}>Close</button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
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
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  No contacts found.
                </td>
              </tr>
            )}
            {filtered.map((c) => (
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
    </div>
  );
}
