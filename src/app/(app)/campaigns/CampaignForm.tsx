"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCampaign, updateCampaign } from "./actions";

type List = { id: string; name: string; _count: { memberships: number } };
type Template = { id: string; subject: string; html: string };

type Campaign = {
  id: string;
  name: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  html: string;
  listId: string | null;
};

const STARTER_HTML = `<div style="font-family:sans-serif;color:#0f172a;max-width:560px;margin:0 auto;">
  <h1>Hi {{firstName}},</h1>
  <p>Your message goes here.</p>
</div>`;

export default function CampaignForm({
  campaign,
  lists,
  templates,
  defaults,
}: {
  campaign?: Campaign;
  lists: List[];
  templates: Template[];
  defaults: { fromName: string; fromEmail: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [html, setHtml] = useState(campaign?.html ?? STARTER_HTML);

  function applyTemplate(id: string) {
    const t = templates.find((x) => x.id === id);
    if (t) setHtml(t.html);
  }

  async function onSubmit(formData: FormData) {
    setError(null);
    formData.set("html", html);
    startTransition(async () => {
      if (campaign) {
        const res = await updateCampaign(campaign.id, formData);
        if (res?.error) setError(res.error);
        else router.refresh();
      } else {
        const res = await createCampaign(formData);
        // createCampaign redirects on success; only errors return here.
        if (res?.error) setError(res.error);
      }
    });
  }

  return (
    <form action={onSubmit} className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <div>
          <label className="label">Campaign name *</label>
          <input name="name" className="input" defaultValue={campaign?.name} placeholder="July Newsletter" required />
        </div>
        <div>
          <label className="label">Subject line *</label>
          <input name="subject" className="input" defaultValue={campaign?.subject} placeholder="News from {{firstName}}'s favorite team" required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">From name</label>
            <input name="fromName" className="input" defaultValue={campaign?.fromName ?? defaults.fromName} />
          </div>
          <div>
            <label className="label">From email *</label>
            <input name="fromEmail" type="email" className="input" defaultValue={campaign?.fromEmail ?? defaults.fromEmail} required />
          </div>
        </div>
        <div>
          <label className="label">Send to list</label>
          <select name="listId" className="input" defaultValue={campaign?.listId ?? ""}>
            <option value="">— Choose a list —</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>{l.name} ({l._count.memberships})</option>
            ))}
          </select>
        </div>
        {templates.length > 0 && (
          <div>
            <label className="label">Start from template</label>
            <select className="input" defaultValue="" onChange={(e) => e.target.value && applyTemplate(e.target.value)}>
              <option value="">— None —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.subject}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="label">HTML body *</label>
          <textarea
            className="input font-mono text-xs"
            rows={14}
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            required
          />
          <p className="mt-1 text-xs text-slate-400">
            Merge tags: {"{{firstName}}"}, {"{{lastName}}"}, {"{{email}}"}. An unsubscribe link is added automatically.
          </p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button className="btn-primary" disabled={pending}>
            {pending ? "Saving…" : campaign ? "Save changes" : "Create campaign"}
          </button>
          <button type="button" className="btn-secondary" onClick={() => router.back()}>Cancel</button>
        </div>
      </div>

      <div>
        <label className="label">Preview</label>
        <div className="h-[560px] overflow-auto rounded-lg border border-slate-200 bg-white p-4">
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
    </form>
  );
}
