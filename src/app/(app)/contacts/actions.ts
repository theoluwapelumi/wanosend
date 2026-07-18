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

type ImportRow = { email: string; firstName: string | null; lastName: string | null };
export type ImportResult = { ok: true; created: number; existing: number; invalid: number; total: number };

/**
 * Bulk-insert contacts in batches (fast + safe for large imports).
 * Uses createMany with skipDuplicates so existing contacts are left untouched,
 * then attaches every processed contact to the target list if one is given.
 */
async function bulkImport(rows: ImportRow[], listId: string | null): Promise<ImportResult> {
  const seen = new Map<string, ImportRow>();
  let invalid = 0;
  for (const r of rows) {
    const email = r.email.trim().toLowerCase();
    if (!isValidEmail(email)) {
      invalid++;
      continue;
    }
    if (!seen.has(email)) {
      seen.set(email, { email, firstName: r.firstName || null, lastName: r.lastName || null });
    }
  }

  const data = [...seen.values()];
  let created = 0;
  const CHUNK = 500;
  for (let i = 0; i < data.length; i += CHUNK) {
    const batch = data.slice(i, i + CHUNK);
    const res = await prisma.contact.createMany({ data: batch, skipDuplicates: true });
    created += res.count;
    if (listId) {
      const emails = batch.map((b) => b.email);
      const contacts = await prisma.contact.findMany({
        where: { email: { in: emails } },
        select: { id: true },
      });
      await prisma.listMembership.createMany({
        data: contacts.map((c) => ({ listId, contactId: c.id })),
        skipDuplicates: true,
      });
    }
  }

  revalidatePath("/contacts");
  if (listId) revalidatePath(`/lists/${listId}`);
  return { ok: true, created, existing: data.length - created, invalid, total: data.length };
}

/** Import contacts from raw CSV text. Recognizes email/first_name/last_name style headers. */
export async function importContactsCsv(csv: string, listId?: string | null): Promise<ImportResult> {
  await guard();
  const parsed = Papa.parse<Record<string, string>>(csv.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
  });

  const rows: ImportRow[] = parsed.data.map((row) => ({
    email: row.email || row.email_address || "",
    firstName: (row.first_name || row.firstname || row.first || "").trim() || null,
    lastName: (row.last_name || row.lastname || row.last || "").trim() || null,
  }));

  return bulkImport(rows, listId ?? null);
}

/**
 * Import contacts from pasted free text — a list of emails separated by
 * commas, spaces, or new lines. "Name <email@x.com>" style is accepted too
 * (the email is extracted).
 */
export async function importPastedEmails(text: string, listId?: string | null): Promise<ImportResult> {
  await guard();
  const matches = text.match(/[^\s,;<>"]+@[^\s,;<>"]+\.[^\s,;<>"]+/g) || [];
  const rows: ImportRow[] = matches.map((email) => ({ email, firstName: null, lastName: null }));
  return bulkImport(rows, listId ?? null);
}
