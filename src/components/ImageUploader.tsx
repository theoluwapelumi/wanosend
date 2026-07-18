"use client";

import { useState, useRef } from "react";

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
const MAX_SIZE_MB = 10;
const ALLOWED = ["image/jpeg", "image/png", "image/gif", "image/webp"];

type Uploaded = { name: string; url: string };

export function ImageUploader() {
  const [uploads, setUploads] = useState<Uploaded[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const configured = Boolean(CLOUD_NAME && UPLOAD_PRESET);

  const upload = (file: File) => {
    setError(null);
    if (!ALLOWED.includes(file.type)) {
      setError(`Unsupported file type: ${file.type}. Use JPG, PNG, GIF, or WebP.`);
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File too large (max ${MAX_SIZE_MB} MB).`);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET!);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      setProgress(null);
      if (xhr.status >= 200 && xhr.status < 300) {
        const res = JSON.parse(xhr.responseText);
        setUploads((prev) => [{ name: file.name, url: res.secure_url }, ...prev]);
      } else {
        setError(`Upload failed (${xhr.status}). Check your preset configuration.`);
      }
    };

    xhr.onerror = () => {
      setProgress(null);
      setError("Network error during upload.");
    };

    setProgress(0);
    xhr.send(formData);
  };

  const copy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {!configured && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-700 dark:text-amber-400 text-sm">
          Cloudinary is not configured. Set{" "}
          <code className="font-mono">NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME</code> and{" "}
          <code className="font-mono">NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET</code> in your
          environment to enable direct uploads.
        </div>
      )}

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) upload(f);
        }}
        className="rounded-lg border border-dashed border-foreground/25 p-8 flex flex-col items-center justify-center gap-3 text-center"
      >
        <p className="text-sm text-foreground/60">
          Drag &amp; drop an image, or choose a file. Returns a hosted URL to paste into your HTML.
        </p>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={!configured || progress !== null}
          className="px-4 py-2 text-sm font-medium border border-foreground/20 rounded-lg hover:bg-foreground/5 disabled:opacity-40"
        >
          {progress !== null ? `Uploading… ${progress}%` : "Choose image"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={ALLOWED.join(",")}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
        {progress !== null && (
          <div className="w-full max-w-xs h-1.5 bg-foreground/10 rounded-full overflow-hidden">
            <div className="h-full bg-foreground transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {uploads.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Uploaded images</h3>
          {uploads.map((u, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-2 border border-foreground/10 rounded-lg"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u.url} alt={u.name} className="w-12 h-12 object-cover rounded shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{u.name}</p>
                <p className="text-xs text-foreground/50 font-mono truncate">{u.url}</p>
              </div>
              <button
                onClick={() => copy(u.url)}
                className="px-3 py-1.5 text-xs font-medium border border-foreground/20 rounded-lg hover:bg-foreground/5 shrink-0"
              >
                {copied === u.url ? "Copied!" : "Copy URL"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
