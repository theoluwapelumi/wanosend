import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import CampaignForm from "../CampaignForm";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
  const [lists, templates] = await Promise.all([
    prisma.contactList.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { memberships: true } } },
    }),
    prisma.template.findMany({ orderBy: { updatedAt: "desc" }, select: { id: true, subject: true, html: true } }),
  ]);

  return (
    <div>
      <div className="mb-2">
        <Link href="/campaigns" className="text-sm text-indigo-600 hover:text-indigo-800">← Back to campaigns</Link>
      </div>
      <PageHeader title="New campaign" subtitle="Compose your email and choose a list." />
      <CampaignForm
        lists={lists}
        templates={templates}
        defaults={{
          fromName: process.env.DEFAULT_FROM_NAME || "Wanosend",
          fromEmail: process.env.DEFAULT_FROM_EMAIL || "onboarding@resend.dev",
        }}
      />
    </div>
  );
}
