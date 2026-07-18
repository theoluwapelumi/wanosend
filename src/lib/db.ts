import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * On serverless (Vercel) each invocation gets its own Prisma client, and a
 * pooled Postgres (e.g. Supabase) has a small max-client limit. Cap each
 * client to a single connection so concurrent invocations don't exhaust the
 * pool ("max clients reached"). Applied only to the runtime client — the
 * Prisma CLI (migrate/seed) reads DATABASE_URL directly.
 */
function runtimeDbUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return url;
  try {
    const u = new URL(url);
    if (!u.searchParams.has("connection_limit")) u.searchParams.set("connection_limit", "1");
    return u.toString();
  } catch {
    return url;
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: runtimeDbUrl() } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
