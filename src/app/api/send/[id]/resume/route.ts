import { NextRequest, NextResponse } from "next/server";
import { resumeJob } from "@/lib/sender";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ok = resumeJob(id);
  if (!ok) {
    return NextResponse.json({ error: "Job not active" }, { status: 400 });
  }
  return NextResponse.json({ status: "sending" });
}
