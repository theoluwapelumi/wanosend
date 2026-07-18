"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

async function guard() {
  const session = await requireApiUser();
  if (!session) throw new Error("Unauthorized");
}

export async function createList(formData: FormData) {
  await guard();
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  if (!name) return { error: "List name is required." };
  await prisma.contactList.create({ data: { name, description } });
  revalidatePath("/lists");
  return { ok: true };
}

export async function deleteList(id: string) {
  await guard();
  await prisma.contactList.delete({ where: { id } });
  revalidatePath("/lists");
  return { ok: true };
}

export async function addContactsToList(listId: string, contactIds: string[]) {
  await guard();
  for (const contactId of contactIds) {
    await prisma.listMembership
      .upsert({
        where: { listId_contactId: { listId, contactId } },
        create: { listId, contactId },
        update: {},
      })
      .catch(() => {});
  }
  revalidatePath(`/lists/${listId}`);
  return { ok: true };
}

/** Add every contact (optionally only subscribed) to the list in one bulk operation. */
export async function addAllContactsToList(listId: string, onlySubscribed = false) {
  await guard();
  const contacts = await prisma.contact.findMany({
    where: onlySubscribed ? { status: "SUBSCRIBED" } : undefined,
    select: { id: true },
  });
  const CHUNK = 1000;
  let added = 0;
  for (let i = 0; i < contacts.length; i += CHUNK) {
    const batch = contacts.slice(i, i + CHUNK);
    const res = await prisma.listMembership.createMany({
      data: batch.map((c) => ({ listId, contactId: c.id })),
      skipDuplicates: true,
    });
    added += res.count;
  }
  revalidatePath(`/lists/${listId}`);
  return { ok: true, added };
}

export async function removeContactFromList(listId: string, contactId: string) {
  await guard();
  await prisma.listMembership
    .delete({ where: { listId_contactId: { listId, contactId } } })
    .catch(() => {});
  revalidatePath(`/lists/${listId}`);
  return { ok: true };
}
