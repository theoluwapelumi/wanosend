import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader, StatusBadge, StatCard } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { mailerIsLive } from "@/lib/mailer";
import CampaignForm from "../CampaignForm";
import CampaignActions from "./CampaignActions";

export const dynamic = "force-dynamic";

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
      messages: {
        orderBy: { createdAt: "desc" },
        take: 100,
      },
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

  const stats = campaign.messages.reduce(
    (acc, m) => {
      acc.total++;
      if (m.status === "SENT" || m.status === "DELIVERED" || m.status === "OPENED" || m.status === "CLICKED") acc.sent++;
      if (m.status === "OPENED" || m.status === "CLICKED") acc.opened++;
      if (m.status === "CLICKED") acc.clicked++;
      if (m.status === "FAILED" || m.status === "BOUNCED") acc.failed++;
      return acc;
    },
    { total: 0, sent: 0, opened: 0, clicked: 0, failed: 0 }
  );

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
      <PageHeader
        title={campaign.name}
        subtitle={campaign.subject}
        action={<StatusBadge status={campaign.status} />}
      />

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
            <div className="card p-5">
              <div className="mb-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                <StatCard label="Recipients" value={stats.total} />
                <StatCard label="Sent" value={stats.sent} />
                <StatCard label="Opened" value={stats.opened} />
                <StatCard label="Failed" value={stats.failed} />
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div dangerouslySetInnerHTML={{ __html: campaign.html }} />
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
              <div className="flex justify-between"><dt>From</dt><dd className="text-right">{campaign.fromName} &lt;{campaign.fromEmail}&gt;</dd></div>
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
          <div className="card overflow-hidden">
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
        </div>
      )}
    </div>
  );
}
