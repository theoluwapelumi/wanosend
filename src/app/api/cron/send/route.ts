import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { processSendingCampaigns, kickProcessor } from "@/lib/send-engine";

// Give background processing room; stays within Vercel's function limits.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const BUDGET_MS = 50_000;

/**
 * Drains queued campaign emails. Called by the Vercel cron schedule (safety
 * net) and self-triggered after each run while work remains, so large sends
 * keep flowing regardless of cron frequency. Returns immediately and does the
 * work in `after()` so the HTTP call is cheap.
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    const key = req.nextUrl.searchParams.get("key");
    if (auth !== `Bearer ${secret}` && key !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  after(async () => {
    try {
      const { remaining } = await processSendingCampaigns(BUDGET_MS);
      if (remaining > 0) await kickProcessor(); // continue the chain
    } catch (e) {
      console.error("cron/send processing error", e);
    }
  });

  return NextResponse.json({ ok: true, started: true });
}

export const GET = handle;
export const POST = handle;
