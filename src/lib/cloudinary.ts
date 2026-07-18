import "server-only";
import { v2 as cloudinary } from "cloudinary";

/**
 * Cloudinary is configured either via a single CLOUDINARY_URL
 * (cloudinary://<api_key>:<api_secret>@<cloud_name>) or the three discrete
 * vars below. When none are set, image hosting is disabled and helpers no-op.
 */
const hasDiscrete =
  !!process.env.CLOUDINARY_CLOUD_NAME &&
  !!process.env.CLOUDINARY_API_KEY &&
  !!process.env.CLOUDINARY_API_SECRET;

export const cloudinaryConfigured = Boolean(process.env.CLOUDINARY_URL) || hasDiscrete;

if (hasDiscrete) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
} else if (process.env.CLOUDINARY_URL) {
  // SDK auto-reads CLOUDINARY_URL; just enforce https delivery.
  cloudinary.config({ secure: true });
}

const FOLDER = process.env.CLOUDINARY_FOLDER || "wanosend";

/** Upload an image (data URI, remote URL, or file path) and return its https URL. */
export async function uploadImage(source: string): Promise<string> {
  if (!cloudinaryConfigured) throw new Error("Image hosting is not configured.");
  const res = await cloudinary.uploader.upload(source, {
    folder: FOLDER,
    resource_type: "image",
  });
  return res.secure_url;
}

// Matches inline base64 images, e.g. data:image/jpeg;base64,AAAA...
const DATA_URI_RE = /data:image\/(?:png|jpe?g|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+/g;

export function htmlHasBase64Image(html: string): boolean {
  DATA_URI_RE.lastIndex = 0;
  return DATA_URI_RE.test(html);
}

/**
 * Replace every inline base64 image in the HTML with a hosted Cloudinary URL.
 * Uploads each distinct data URI once. Returns the rewritten HTML and how many
 * images were replaced. If Cloudinary isn't configured, returns HTML unchanged.
 */
export async function rewriteBase64Images(
  html: string
): Promise<{ html: string; replaced: number }> {
  if (!cloudinaryConfigured) return { html, replaced: 0 };

  const matches = html.match(DATA_URI_RE);
  if (!matches || matches.length === 0) return { html, replaced: 0 };

  const unique = Array.from(new Set(matches));
  let out = html;
  let replaced = 0;

  for (const dataUri of unique) {
    try {
      const url = await uploadImage(dataUri);
      out = out.split(dataUri).join(url);
      replaced++;
    } catch {
      // Leave this image as-is if the upload fails; don't block the send.
    }
  }

  return { html: out, replaced };
}
