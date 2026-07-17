/** Render {{firstName}} / {{lastName}} / {{email}} style merge tags. */
export function renderMergeTags(
  template: string,
  vars: Record<string, string | null | undefined>
): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    const v = vars[key];
    return v == null ? "" : String(v);
  });
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function contactName(c: { firstName?: string | null; lastName?: string | null }) {
  return [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
}

export function classNames(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

export function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Append an unsubscribe footer link to an HTML body. */
export function withUnsubscribeFooter(html: string, unsubUrl: string): string {
  const footer = `
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;font-family:sans-serif;">
      Don't want these emails?
      <a href="${unsubUrl}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>.
    </div>`;
  if (html.includes("</body>")) return html.replace("</body>", `${footer}</body>`);
  return html + footer;
}
