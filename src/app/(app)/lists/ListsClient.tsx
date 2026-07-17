"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { createList, deleteList } from "./actions";

type List = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  _count: { memberships: number };
};

export default function ListsClient({ lists }: { lists: List[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAdd(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createList(formData);
      if (res?.error) setError(res.error);
      else {
        setShowAdd(false);
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this list? Contacts are not deleted.")) return;
    startTransition(async () => {
      await deleteList(id);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button className="btn-primary" onClick={() => setShowAdd((v) => !v)}>New list</button>
      </div>

      {showAdd && (
        <form action={onAdd} className="card mb-4 space-y-3 p-4">
          <div>
            <label className="label">Name *</label>
            <input name="name" className="input" required />
          </div>
          <div>
            <label className="label">Description</label>
            <input name="description" className="input" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button className="btn-primary" disabled={pending}>Create list</button>
            <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </form>
      )}

      {lists.length === 0 ? (
        <div className="card px-6 py-16 text-center text-sm text-slate-400">
          No lists yet. Create one to group your contacts.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map((l) => (
            <div key={l.id} className="card flex flex-col p-5">
              <Link href={`/lists/${l.id}`} className="text-lg font-semibold text-slate-900 hover:text-indigo-600">
                {l.name}
              </Link>
              {l.description && <p className="mt-1 text-sm text-slate-500">{l.description}</p>}
              <p className="mt-3 text-sm text-slate-600">
                <span className="font-semibold text-slate-900">{l._count.memberships}</span> contacts
              </p>
              <p className="mt-1 text-xs text-slate-400">Created {formatDate(l.createdAt)}</p>
              <div className="mt-4 flex gap-3 border-t border-slate-100 pt-3">
                <Link href={`/lists/${l.id}`} className="text-sm text-indigo-600 hover:text-indigo-800">Manage</Link>
                <button className="ml-auto text-sm text-red-500 hover:text-red-700" onClick={() => remove(l.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
