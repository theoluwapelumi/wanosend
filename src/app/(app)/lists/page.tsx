import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import ListsClient from "./ListsClient";

export const dynamic = "force-dynamic";

export default async function ListsPage() {
  const lists = await prisma.contactList.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { memberships: true } } },
  });

  return (
    <div>
      <PageHeader title="Lists" subtitle="Group contacts into audiences you can send to." />
      <ListsClient lists={lists} />
    </div>
  );
}
