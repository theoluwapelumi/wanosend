import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, StatCard, StatusBadge, LinkButton } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { mailerIsLive } from "@/lib/mailer";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [contacts, subscribed, lists, campaigns, sentMessages, recentCampaigns] =
    await Promise.all([
      prisma.contact.count(),
      prisma.contact.count({ where: { status: "SUBSCRIBED" } }),
      prisma.contactList.count(),
      prisma.campaign.count(),
      prisma.message.count({ where: { status: { in: ["SENT", "DELIVERED", "OPENED", "CLICKED"] } } }),
      prisma.campaign.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { list: { select: { name: true } }, _count: { select: { messages: true } } },
      }),
    ]);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your audience and sending activity."
        action={<LinkButton href="/campaigns/new">New campaign</LinkButton>}
      />

      {!mailerIsLive && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Dry-run mode.</strong> Add a <code>RESEND_API_KEY</code> to{" "}
          <code>.env</code> to deliver real email. Until then, sends are logged
          but not delivered.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Contacts" value={contacts} hint={`${subscribed} subscribed`} />
        <StatCard label="Lists" value={lists} />
        <StatCard label="Campaigns" value={campaigns} />
        <StatCard label="Emails sent" value={sentMessages} />
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Recent campaigns</h2>
          <Link href="/campaigns" className="text-sm text-indigo-600 hover:text-indigo-800">View all</Link>
        </div>
        {recentCampaigns.length === 0 ? (
          <div className="card px-6 py-12 text-center text-sm text-slate-400">
            No campaigns yet. <Link href="/campaigns/new" className="text-indigo-600">Create one →</Link>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Campaign</th>
                  <th className="px-4 py-3">List</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Recipients</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentCampaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/campaigns/${c.id}`} className="font-medium text-slate-900 hover:text-indigo-600">{c.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.list?.name || "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3 text-slate-600">{c._count.messages}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
