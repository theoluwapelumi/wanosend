import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || "admin@wanosend.dev";
  const password = process.env.SEED_ADMIN_PASSWORD || "password123";
  const hash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Admin", password: hash },
  });
  console.log(`Seeded admin user: ${user.email} (password: ${password})`);

  // A demo list + a couple contacts so the UI isn't empty.
  const list = await prisma.contactList.upsert({
    where: { id: "demo-list" },
    update: {},
    create: { id: "demo-list", name: "Newsletter", description: "Demo subscriber list" },
  });

  const demoContacts = [
    { email: "ada@example.com", firstName: "Ada", lastName: "Lovelace" },
    { email: "alan@example.com", firstName: "Alan", lastName: "Turing" },
    { email: "grace@example.com", firstName: "Grace", lastName: "Hopper" },
  ];

  for (const c of demoContacts) {
    const contact = await prisma.contact.upsert({
      where: { email: c.email },
      update: {},
      create: c,
    });
    await prisma.listMembership.upsert({
      where: { listId_contactId: { listId: list.id, contactId: contact.id } },
      update: {},
      create: { listId: list.id, contactId: contact.id },
    });
  }
  console.log(`Seeded list "${list.name}" with ${demoContacts.length} contacts.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
