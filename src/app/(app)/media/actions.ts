"use server";

import { requireApiUser } from "@/lib/auth";
import { cloudinaryConfigured, uploadImage } from "@/lib/cloudinary";

export type UploadResult = { ok: true; url: string } | { ok: false; error: string };

/** Upload an image file to Cloudinary and return its hosted https URL. */
export async function uploadImageAction(formData: FormData): Promise<UploadResult> {
  const session = await requireApiUser();
  if (!session) return { ok: false, error: "Unauthorized" };

  if (!cloudinaryConfigured) {
    return { ok: false, error: "Image hosting isn't configured yet. Add your Cloudinary credentials." };
  }

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: false, error: "Choose an image first." };
  if (!file.type.startsWith("image/")) return { ok: false, error: "That file isn't an image." };
  if (file.size > 10 * 1024 * 1024) return { ok: false, error: "Image must be under 10 MB." };

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const dataUri = `data:${file.type};base64,${buf.toString("base64")}`;
    const url = await uploadImage(dataUri);
    return { ok: true, url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Upload failed." };
  }
}
