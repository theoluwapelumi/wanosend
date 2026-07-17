import Link from "next/link";
import { classNames } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-sm font-medium text-slate-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  SUBSCRIBED: "bg-green-100 text-green-800",
  UNSUBSCRIBED: "bg-slate-100 text-slate-600",
  BOUNCED: "bg-amber-100 text-amber-800",
  COMPLAINED: "bg-red-100 text-red-800",
  DRAFT: "bg-slate-100 text-slate-700",
  SENDING: "bg-blue-100 text-blue-800",
  SENT: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  QUEUED: "bg-slate-100 text-slate-700",
  DELIVERED: "bg-green-100 text-green-800",
  OPENED: "bg-indigo-100 text-indigo-800",
  CLICKED: "bg-purple-100 text-purple-800",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={classNames("badge", STATUS_STYLES[status] || "bg-slate-100 text-slate-700")}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function LinkButton({ href, children, variant = "primary" }: { href: string; children: React.ReactNode; variant?: "primary" | "secondary" }) {
  return (
    <Link href={href} className={variant === "primary" ? "btn-primary" : "btn-secondary"}>
      {children}
    </Link>
  );
}
