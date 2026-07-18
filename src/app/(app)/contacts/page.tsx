import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { PageHeader } from "@/components/ui";
import ContactsClient from "./ContactsClient";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const query = (sp.q || "").trim();
  const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);

  const where: Prisma.ContactWhereInput = query
    ? {
        OR: [
          { email: { contains: query, mode: "insensitive" } },
          { firstName: { contains: query, mode: "insensitive" } },
          { lastName: { contains: query, mode: "insensitive" } },
        ],
      }
    : {};

  const [total, contacts, lists] = await Promise.all([
    prisma.contact.count({ where }),
    prisma.contact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { memberships: true } } },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.contactList.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div>
      <PageHeader title="Contacts" subtitle={`${total} total contacts`} />
      <ContactsClient
        contacts={contacts}
        lists={lists}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        query={query}
      />
    </div>
  );
}
