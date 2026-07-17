import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import TemplatesClient from "./TemplatesClient";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const templates = await prisma.template.findMany({ orderBy: { updatedAt: "desc" } });
  return (
    <div>
      <PageHeader title="Templates" subtitle="Reusable email designs for your campaigns." />
      <TemplatesClient templates={templates} />
    </div>
  );
}
