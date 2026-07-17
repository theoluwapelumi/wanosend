"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui";
import { contactName } from "@/lib/utils";
import { addContactsToList, removeContactFromList } from "../actions";
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
  candidates,
}: {
  listId: string;
  members: Member[];
  candidates: Member[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function addSelected() {
    if (selected.length === 0) return;
    startTransition(async () => {
      await addContactsToList(listId, selected);
      setSelected([]);
      setShowAdd(false);
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
      <div className="mb-4 flex justify-end">
        <button className="btn-primary" onClick={() => setShowAdd((v) => !v)}>
          Add contacts
        </button>
      </div>

      {showAdd && (
        <div className="card mb-4 p-4">
          <p className="mb-3 text-sm font-medium text-slate-700">Select contacts to add</p>
          {candidates.length === 0 ? (
            <p className="text-sm text-slate-400">All contacts are already in this list.</p>
          ) : (
            <>
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {candidates.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded px-2 py-1.5 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={selected.includes(c.id)}
                      onChange={() => toggle(c.id)}
                    />
                    <span className="text-sm text-slate-900">{contactName(c) || c.email}</span>
                    <span className="text-xs text-slate-400">{c.email}</span>
                  </label>
                ))}
              </div>
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

      <div className="card overflow-hidden">
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
    </div>
  );
}
