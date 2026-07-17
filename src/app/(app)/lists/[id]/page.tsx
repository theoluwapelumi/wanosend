import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import ListDetailClient from "./ListDetailClient";

export const dynamic = "force-dynamic";

export default async function ListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const list = await prisma.contactList.findUnique({
    where: { id },
    include: {
      memberships: {
        include: { contact: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!list) notFound();

  const members = list.memberships.map((m) => m.contact);
  const memberIds = new Set(members.map((c) => c.id));
  const candidates = (
    await prisma.contact.findMany({ orderBy: { createdAt: "desc" } })
  ).filter((c) => !memberIds.has(c.id));

  return (
    <div>
      <div className="mb-2">
        <Link href="/lists" className="text-sm text-indigo-600 hover:text-indigo-800">← Back to lists</Link>
      </div>
      <PageHeader
        title={list.name}
        subtitle={`${members.length} contacts${list.description ? " · " + list.description : ""}`}
      />
      <ListDetailClient listId={list.id} members={members} candidates={candidates} />
    </div>
  );
}
