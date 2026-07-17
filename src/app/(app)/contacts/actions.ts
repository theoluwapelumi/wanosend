"use server";

import { revalidatePath } from "next/cache";
import Papa from "papaparse";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { isValidEmail } from "@/lib/utils";
import { ContactStatus } from "@prisma/client";

async function guard() {
  const session = await requireApiUser();
  if (!session) throw new Error("Unauthorized");
}

export async function createContact(formData: FormData) {
  await guard();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const firstName = String(formData.get("firstName") || "").trim() || null;
  const lastName = String(formData.get("lastName") || "").trim() || null;
  const listId = String(formData.get("listId") || "").trim() || null;

  if (!isValidEmail(email)) return { error: "Please enter a valid email address." };

  const existing = await prisma.contact.findUnique({ where: { email } });
  if (existing) return { error: "A contact with that email already exists." };

  const contact = await prisma.contact.create({ data: { email, firstName, lastName } });
  if (listId) {
    await prisma.listMembership.create({ data: { contactId: contact.id, listId } }).catch(() => {});
  }
  revalidatePath("/contacts");
  return { ok: true };
}

export async function updateContactStatus(id: string, status: ContactStatus) {
  await guard();
  await prisma.contact.update({ where: { id }, data: { status } });
  revalidatePath("/contacts");
  return { ok: true };
}

export async function deleteContact(id: string) {
  await guard();
  await prisma.contact.delete({ where: { id } });
  revalidatePath("/contacts");
  return { ok: true };
}

/** Import contacts from raw CSV text. Recognizes email/first_name/last_name style headers. */
export async function importContactsCsv(csv: string, listId?: string | null) {
  await guard();
  const parsed = Papa.parse<Record<string, string>>(csv.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
  });

  let created = 0;
  let skipped = 0;
  let invalid = 0;

  for (const row of parsed.data) {
    const email = (row.email || row.email_address || "").trim().toLowerCase();
    if (!isValidEmail(email)) {
      invalid++;
      continue;
    }
    const firstName = (row.first_name || row.firstname || row.first || "").trim() || null;
    const lastName = (row.last_name || row.lastname || row.last || "").trim() || null;

    try {
      const contact = await prisma.contact.upsert({
        where: { email },
        create: { email, firstName, lastName },
        update: {
          firstName: firstName ?? undefined,
          lastName: lastName ?? undefined,
        },
      });
      if (listId) {
        await prisma.listMembership
          .upsert({
            where: { listId_contactId: { listId, contactId: contact.id } },
            create: { listId, contactId: contact.id },
            update: {},
          })
          .catch(() => {});
      }
      created++;
    } catch {
      skipped++;
    }
  }

  revalidatePath("/contacts");
  return { ok: true, created, skipped, invalid };
}
