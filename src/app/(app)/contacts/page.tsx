import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import ContactsClient from "./ContactsClient";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const [contacts, lists] = await Promise.all([
    prisma.contact.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { memberships: true } } },
    }),
    prisma.contactList.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Contacts"
        subtitle={`${contacts.length} total contacts`}
      />
      <ContactsClient contacts={contacts} lists={lists} />
    </div>
  );
}
