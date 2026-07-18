"use client";

import { useState } from "react";

export function HtmlEditor({
  html,
  onChange,
}: {
  html: string;
  onChange: (html: string) => void;
}) {
  const [view, setView] = useState<"desktop" | "mobile">("desktop");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="flex flex-col">
        <label className="block text-sm font-medium mb-1">Raw HTML</label>
        <textarea
          value={html}
          onChange={(e) => onChange(e.target.value)}
          placeholder="<html>&#10;  <body>&#10;    <h1>Hello {{first_name}}</h1>&#10;  </body>&#10;</html>"
          spellCheck={false}
          className="w-full h-[500px] px-3 py-2 rounded-lg border border-foreground/20 bg-background text-foreground text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-foreground/30"
        />
        <p className="text-xs text-foreground/50 mt-1">
          Use <code className="font-mono">{"{{column_name}}"}</code> for merge tags resolved from CSV columns.
        </p>
      </div>

      <div className="flex flex-col">
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium">Live Preview</label>
          <div className="flex gap-1 text-xs">
            <button
              onClick={() => setView("desktop")}
              className={`px-2 py-1 rounded ${
                view === "desktop" ? "bg-foreground/10 font-medium" : "text-foreground/50"
              }`}
            >
              Desktop
            </button>
            <button
              onClick={() => setView("mobile")}
              className={`px-2 py-1 rounded ${
                view === "mobile" ? "bg-foreground/10 font-medium" : "text-foreground/50"
              }`}
            >
              Mobile
            </button>
          </div>
        </div>
        <div className="h-[500px] rounded-lg border border-foreground/20 bg-white overflow-auto flex justify-center">
          <iframe
            title="Email preview"
            srcDoc={html || "<p style='font-family:sans-serif;color:#999;padding:16px'>Preview will render here…</p>"}
            sandbox=""
            className="bg-white h-full transition-all"
            style={{ width: view === "mobile" ? "375px" : "100%" }}
          />
        </div>
      </div>
    </div>
  );
}
