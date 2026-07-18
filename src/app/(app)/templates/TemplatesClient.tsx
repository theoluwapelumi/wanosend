"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ImageUploadButton from "@/components/ImageUploadButton";
import { formatDate } from "@/lib/utils";
import { deleteTemplate, saveTemplate } from "./actions";

type Template = {
  id: string;
  name: string;
  subject: string;
  html: string;
  updatedAt: Date;
};

const STARTER_HTML = `<div style="font-family:sans-serif;color:#0f172a;max-width:560px;margin:0 auto;">
  <h1>Hello {{firstName}}!</h1>
  <p>Write your message here. You can personalize with merge tags like
  {{firstName}}, {{lastName}} and {{email}}.</p>
  <p>
    <a href="https://example.com"
       style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;">
      Call to action
    </a>
  </p>
</div>`;

export default function TemplatesClient({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<Template | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const htmlRef = useRef<HTMLTextAreaElement>(null);

  function insertImage(tag: string) {
    const ta = htmlRef.current;
    if (!ta) return;
    ta.value = `${ta.value}\n${tag}`;
    setPreviewHtml(ta.value);
  }

  function openNew() {
    setError(null);
    setEditing("new");
    setPreviewHtml(STARTER_HTML);
  }
  function openEdit(t: Template) {
    setError(null);
    setEditing(t);
    setPreviewHtml(t.html);
  }

  async function onSave(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await saveTemplate(formData);
      if (res?.error) setError(res.error);
      else {
        setEditing(null);
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this template?")) return;
    startTransition(async () => {
      await deleteTemplate(id);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button className="btn-primary" onClick={openNew}>New template</button>
      </div>

      {editing && (
        <form action={onSave} className="card mb-6 p-5">
          {editing !== "new" && <input type="hidden" name="id" value={editing.id} />}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <div>
                <label className="label">Template name *</label>
                <input name="name" className="input" defaultValue={editing !== "new" ? editing.name : ""} required />
              </div>
              <div>
                <label className="label">Subject *</label>
                <input name="subject" className="input" defaultValue={editing !== "new" ? editing.subject : ""} required />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label className="label mb-0">HTML body *</label>
                  <ImageUploadButton onInserted={(tag) => insertImage(tag)} />
                </div>
                <textarea
                  ref={htmlRef}
                  name="html"
                  className="input font-mono text-xs"
                  rows={16}
                  defaultValue={editing !== "new" ? editing.html : STARTER_HTML}
                  onChange={(e) => setPreviewHtml(e.target.value)}
                  required
                />
                <p className="mt-1 text-xs text-slate-400">
                  Merge tags: {"{{firstName}}"}, {"{{lastName}}"}, {"{{email}}"}
                </p>
              </div>
            </div>
            <div>
              <label className="label">Live preview</label>
              <div className="h-[420px] overflow-auto rounded-lg border border-slate-200 bg-white p-4">
                <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
              </div>
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save template"}</button>
            <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      )}

      {templates.length === 0 && !editing ? (
        <div className="card px-6 py-16 text-center text-sm text-slate-400">
          No templates yet. Create reusable email designs to speed up campaigns.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <div key={t.id} className="card flex flex-col p-5">
              <p className="text-lg font-semibold text-slate-900">{t.name}</p>
              <p className="mt-1 truncate text-sm text-slate-500">{t.subject}</p>
              <p className="mt-2 text-xs text-slate-400">Updated {formatDate(t.updatedAt)}</p>
              <div className="mt-4 flex gap-3 border-t border-slate-100 pt-3">
                <button className="text-sm text-indigo-600 hover:text-indigo-800" onClick={() => openEdit(t)}>Edit</button>
                <button className="ml-auto text-sm text-red-500 hover:text-red-700" onClick={() => remove(t.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
