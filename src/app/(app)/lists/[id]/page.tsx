import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import ListDetailClient from "./ListDetailClient";

export const dynamic = "force-dynamic";

const MEMBER_LIMIT = 200;
const CANDIDATE_LIMIT = 500;

export default async function ListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const list = await prisma.contactList.findUnique({ where: { id } });
  if (!list) notFound();

  const notInList = { memberships: { none: { listId: id } } } as const;

  const [memberTotal, memberships, candidateTotal, candidates] = await Promise.all([
    prisma.listMembership.count({ where: { listId: id } }),
    prisma.listMembership.findMany({
      where: { listId: id },
      include: { contact: true },
      orderBy: { createdAt: "desc" },
      take: MEMBER_LIMIT,
    }),
    prisma.contact.count({ where: notInList }),
    prisma.contact.findMany({
      where: notInList,
      orderBy: { createdAt: "desc" },
      take: CANDIDATE_LIMIT,
    }),
  ]);

  const members = memberships.map((m) => m.contact);

  return (
    <div>
      <div className="mb-2">
        <Link href="/lists" className="text-sm text-indigo-600 hover:text-indigo-800">← Back to lists</Link>
      </div>
      <PageHeader
        title={list.name}
        subtitle={`${memberTotal} contacts${list.description ? " · " + list.description : ""}`}
      />
      <ListDetailClient
        listId={list.id}
        members={members}
        memberTotal={memberTotal}
        candidates={candidates}
        candidateTotal={candidateTotal}
      />
    </div>
  );
}
