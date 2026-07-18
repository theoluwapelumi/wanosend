import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader, StatusBadge, StatCard } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { mailerIsLive } from "@/lib/mailer";
import CampaignForm from "../CampaignForm";
import CampaignActions from "./CampaignActions";

export const dynamic = "force-dynamic";

function pct(n: number, d: number) {
  if (d <= 0) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      list: { include: { _count: { select: { memberships: true } } } },
      messages: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  });
  if (!campaign) notFound();

  const isDraft = campaign.status === "DRAFT";

  // Recipient count = subscribed contacts in the attached list.
  let recipientCount = 0;
  if (campaign.listId) {
    recipientCount = await prisma.listMembership.count({
      where: { listId: campaign.listId, contact: { status: "SUBSCRIBED" } },
    });
  }

  // Full analytics computed across ALL messages (not just the 100 shown in the log).
  const [total, sent, delivered, opened, clicked, bounced, complained, failed] =
    await Promise.all([
      prisma.message.count({ where: { campaignId: id } }),
      prisma.message.count({ where: { campaignId: id, status: { notIn: ["QUEUED", "FAILED"] } } }),
      prisma.message.count({ where: { campaignId: id, status: { in: ["DELIVERED", "OPENED", "CLICKED"] } } }),
      prisma.message.count({ where: { campaignId: id, OR: [{ openedAt: { not: null } }, { status: { in: ["OPENED", "CLICKED"] } }] } }),
      prisma.message.count({ where: { campaignId: id, OR: [{ clickedAt: { not: null } }, { status: "CLICKED" }] } }),
      prisma.message.count({ where: { campaignId: id, status: "BOUNCED" } }),
      prisma.message.count({ where: { campaignId: id, status: "COMPLAINED" } }),
      prisma.message.count({ where: { campaignId: id, status: "FAILED" } }),
    ]);

  const rates = [
    { label: "Delivery rate", value: pct(delivered, sent), hint: `${delivered} of ${sent} sent` },
    { label: "Open rate", value: pct(opened, delivered), hint: `${opened} of ${delivered} delivered` },
    { label: "Click rate (CTR)", value: pct(clicked, delivered), hint: `${clicked} of ${delivered} delivered` },
    { label: "Click-to-open", value: pct(clicked, opened), hint: `${clicked} of ${opened} opened` },
    { label: "Bounce rate", value: pct(bounced, sent), hint: `${bounced} of ${sent} sent` },
    { label: "Complaint rate", value: pct(complained, sent), hint: `${complained} of ${sent} sent` },
  ];

  const [lists, templates] = isDraft
    ? await Promise.all([
        prisma.contactList.findMany({
          orderBy: { name: "asc" },
          include: { _count: { select: { memberships: true } } },
        }),
        prisma.template.findMany({ orderBy: { updatedAt: "desc" }, select: { id: true, subject: true, html: true } }),
      ])
    : [[], []];

  return (
    <div>
      <div className="mb-2">
        <Link href="/campaigns" className="text-sm text-indigo-600 hover:text-indigo-800">← Back to campaigns</Link>
      </div>
      <PageHeader title={campaign.name} subtitle={campaign.subject} action={<StatusBadge status={campaign.status} />} />

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {isDraft ? (
            <CampaignForm
              campaign={{
                id: campaign.id,
                name: campaign.name,
                subject: campaign.subject,
                fromName: campaign.fromName,
                fromEmail: campaign.fromEmail,
                html: campaign.html,
                listId: campaign.listId,
              }}
              lists={lists as never}
              templates={templates as never}
              defaults={{ fromName: campaign.fromName, fromEmail: campaign.fromEmail }}
            />
          ) : (
            <div className="space-y-6">
              <div>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Performance</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {rates.map((r) => (
                    <StatCard key={r.label} label={r.label} value={r.value} hint={r.hint} />
                  ))}
                </div>
              </div>

              <div>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Counts</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatCard label="Recipients" value={total} />
                  <StatCard label="Sent" value={sent} />
                  <StatCard label="Delivered" value={delivered} />
                  <StatCard label="Opened" value={opened} />
                  <StatCard label="Clicked" value={clicked} />
                  <StatCard label="Bounced" value={bounced} />
                  <StatCard label="Complaints" value={complained} />
                  <StatCard label="Failed" value={failed} />
                </div>
              </div>

              <div className="card p-5">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Email content</h2>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div dangerouslySetInnerHTML={{ __html: campaign.html }} />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <CampaignActions
            id={campaign.id}
            status={campaign.status}
            recipientCount={recipientCount}
            mailerLive={mailerIsLive}
          />
          <div className="card p-5 text-sm">
            <p className="mb-2 font-semibold text-slate-900">Details</p>
            <dl className="space-y-1 text-slate-600">
              <div className="flex justify-between gap-2"><dt>From</dt><dd className="text-right">{campaign.fromName} &lt;{campaign.fromEmail}&gt;</dd></div>
              <div className="flex justify-between"><dt>List</dt><dd>{campaign.list?.name || "—"}</dd></div>
              <div className="flex justify-between"><dt>Subscribed</dt><dd>{recipientCount}</dd></div>
              <div className="flex justify-between"><dt>Created</dt><dd>{formatDate(campaign.createdAt)}</dd></div>
              <div className="flex justify-between"><dt>Sent</dt><dd>{formatDate(campaign.sentAt)}</dd></div>
            </dl>
          </div>
        </div>
      </div>

      {campaign.messages.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Delivery log</h2>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Recipient</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Sent</th>
                  <th className="px-4 py-3">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {campaign.messages.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">{m.email}</td>
                    <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(m.sentAt)}</td>
                    <td className="px-4 py-3 text-xs text-red-500">{m.error || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > campaign.messages.length && (
            <p className="mt-3 text-xs text-slate-400">
              Showing the {campaign.messages.length} most recent of {total} messages.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
