import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // --- Admin user ---------------------------------------------------------
  // In production, set SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD as env vars.
  // Locally these default to demo credentials for convenience.
  const isProd = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  const email = process.env.SEED_ADMIN_EMAIL || (isProd ? "" : "admin@wanosend.dev");
  const password = process.env.SEED_ADMIN_PASSWORD || (isProd ? "" : "password123");

  if (!email || !password) {
    console.log(
      "Skipping admin seed: set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create the admin user."
    );
  } else {
    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.upsert({
      where: { email: email.toLowerCase() },
      update: {},
      create: { email: email.toLowerCase(), name: "Admin", password: hash },
    });
    console.log(`Seeded admin user: ${user.email}`);
  }

  // --- Demo data (opt-in) -------------------------------------------------
  // Only injected when SEED_DEMO=true, so production stays clean.
  if (process.env.SEED_DEMO !== "true") {
    console.log("Skipping demo data (set SEED_DEMO=true to include it).");
    return;
  }

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
    // Don't fail the Vercel build if seeding hits a transient issue.
    await prisma.$disconnect().catch(() => {});
    process.exit(process.env.VERCEL === "1" ? 0 : 1);
  });
