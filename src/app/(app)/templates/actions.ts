"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

async function guard() {
  const session = await requireApiUser();
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function saveTemplate(formData: FormData) {
  const session = await guard();
  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const subject = String(formData.get("subject") || "").trim();
  const html = String(formData.get("html") || "");

  if (!name || !subject || !html.trim()) {
    return { error: "Name, subject, and body are all required." };
  }

  if (id) {
    await prisma.template.update({ where: { id }, data: { name, subject, html } });
  } else {
    await prisma.template.create({
      data: { name, subject, html, authorId: session.userId },
    });
  }
  revalidatePath("/templates");
  return { ok: true };
}

export async function deleteTemplate(id: string) {
  await guard();
  await prisma.template.delete({ where: { id } });
  revalidatePath("/templates");
  return { ok: true };
}
