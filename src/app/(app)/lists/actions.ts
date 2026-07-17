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

export async function removeContactFromList(listId: string, contactId: string) {
  await guard();
  await prisma.listMembership
    .delete({ where: { listId_contactId: { listId, contactId } } })
    .catch(() => {});
  revalidatePath(`/lists/${listId}`);
  return { ok: true };
}
