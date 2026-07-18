"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui";
import { contactName } from "@/lib/utils";
import { addAllContactsToList, addContactsToList, removeContactFromList } from "../actions";
import type { ContactStatus } from "@prisma/client";

type Member = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: ContactStatus;
};

export default function ListDetailClient({
  listId,
  members,
  memberTotal,
  candidates,
  candidateTotal,
}: {
  listId: string;
  members: Member[];
  memberTotal: number;
  candidates: Member[];
  candidateTotal: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const visible = candidates.filter((c) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return c.email.toLowerCase().includes(q) || contactName(c).toLowerCase().includes(q);
  });

  const allVisibleSelected = visible.length > 0 && visible.every((c) => selected.includes(c.id));

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      const visibleIds = new Set(visible.map((c) => c.id));
      setSelected((s) => s.filter((id) => !visibleIds.has(id)));
    } else {
      setSelected((s) => Array.from(new Set([...s, ...visible.map((c) => c.id)])));
    }
  }

  function addSelected() {
    if (selected.length === 0) return;
    startTransition(async () => {
      await addContactsToList(listId, selected);
      setSelected([]);
      setShowAdd(false);
      setMsg(null);
      router.refresh();
    });
  }

  function addEveryone() {
    if (!confirm(`Add all ${candidateTotal} remaining contacts to this list?`)) return;
    startTransition(async () => {
      const res = await addAllContactsToList(listId);
      setSelected([]);
      setShowAdd(false);
      setMsg(res?.ok ? `Added ${res.added} contacts to the list.` : null);
      router.refresh();
    });
  }

  function remove(contactId: string) {
    startTransition(async () => {
      await removeContactFromList(listId, contactId);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-end gap-2">
        {candidateTotal > 0 && (
          <button className="btn-secondary" onClick={addEveryone} disabled={pending}>
            Add all {candidateTotal} contacts
          </button>
        )}
        <button className="btn-primary" onClick={() => setShowAdd((v) => !v)} disabled={candidateTotal === 0}>
          Add contacts
        </button>
      </div>

      {msg && <p className="mb-4 text-sm text-green-700">{msg}</p>}

      {showAdd && (
        <div className="card mb-4 p-4">
          {candidates.length === 0 ? (
            <p className="text-sm text-slate-400">All contacts are already in this list.</p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <input
                  className="input max-w-xs"
                  placeholder="Filter contacts…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
                <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} />
                  Select all{filter ? " shown" : ""}
                </label>
              </div>
              <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-slate-100 p-1">
                {visible.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded px-2 py-1.5 hover:bg-slate-50">
                    <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} />
                    <span className="text-sm text-slate-900">{contactName(c) || c.email}</span>
                    <span className="text-xs text-slate-400">{c.email}</span>
                  </label>
                ))}
                {visible.length === 0 && (
                  <p className="px-2 py-4 text-center text-sm text-slate-400">No matches.</p>
                )}
              </div>
              {candidateTotal > candidates.length && (
                <p className="mt-2 text-xs text-slate-400">
                  Showing the first {candidates.length} of {candidateTotal} available contacts. Use “Add all” to include every one.
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <button className="btn-primary" disabled={pending || selected.length === 0} onClick={addSelected}>
                  Add {selected.length > 0 ? `${selected.length} ` : ""}selected
                </button>
                <button className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
              </div>
            </>
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
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {members.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-400">No contacts in this list yet.</td></tr>
            )}
            {members.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{contactName(c) || "—"}</td>
                <td className="px-4 py-3 text-slate-600">{c.email}</td>
                <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                <td className="px-4 py-3 text-right">
                  <button className="text-xs text-red-500 hover:text-red-700" onClick={() => remove(c.id)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {memberTotal > members.length && (
        <p className="mt-3 text-xs text-slate-400">
          Showing the {members.length} most recent of {memberTotal} contacts in this list.
        </p>
      )}
    </div>
  );
}
