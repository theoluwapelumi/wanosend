"use client";

import { useRef, useState, useTransition } from "react";
import { uploadImageAction } from "@/app/(app)/media/actions";

/**
 * Uploads an image to Cloudinary and hands back an <img> snippet (with a
 * hosted https URL) for the caller to insert into the email HTML.
 */
export default function ImageUploadButton({
  onInserted,
}: {
  onInserted: (imgTag: string, url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    const fd = new FormData();
    fd.set("file", file);
    start(async () => {
      const res = await uploadImageAction(fd);
      if (res.ok) {
        const tag = `<img src="${res.url}" alt="" width="600" style="max-width:100%;height:auto;display:block;" />`;
        onInserted(tag, res.url);
      } else {
        setErr(res.error);
      }
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        className="btn-secondary text-xs"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
      >
        {pending ? "Uploading…" : "🖼 Insert image"}
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={onChange} />
      {err && <span className="mt-1 max-w-xs text-xs text-red-600">{err}</span>}
    </span>
  );
}
