import { PrismaClient, Prisma } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * On serverless (Vercel) each invocation gets its own Prisma client, and a
 * pooled Postgres (e.g. Supabase) has a small max-client limit. So:
 *   - cap each client to a single connection (connection_limit=1) so concurrent
 *     invocations don't exhaust the pool ("max clients reached"), and
 *   - set pgbouncer=true so Prisma skips prepared statements, which is required
 *     when DATABASE_URL points at a transaction-mode pooler (Supabase :6543).
 * Applied only to the runtime client — migrations use DIRECT_URL (see schema).
 */
function runtimeDbUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return url;
  try {
    const u = new URL(url);
    if (!u.searchParams.has("connection_limit")) u.searchParams.set("connection_limit", "1");
    if (!u.searchParams.has("pgbouncer")) u.searchParams.set("pgbouncer", "true");
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

/** True for transient "can't get a connection" style failures worth retrying. */
function isTransientDbError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientInitializationError) return true;
  const msg = err instanceof Error ? err.message.toLowerCase() : "";
  return (
    msg.includes("max clients") ||
    msg.includes("too many connections") ||
    msg.includes("can't reach database") ||
    msg.includes("connection pool") ||
    msg.includes("timed out fetching a new connection")
  );
}

/**
 * Run a DB operation with a few backoff retries on transient connection
 * failures (pool saturation during a large send), so a brief spike doesn't
 * surface as a 500. Non-connection errors are rethrown immediately.
 */
export async function withDbRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (!isTransientDbError(err) || i === attempts - 1) throw err;
      lastErr = err;
      await new Promise((r) => setTimeout(r, 150 * 2 ** i + Math.random() * 100));
    }
  }
  throw lastErr;
}
