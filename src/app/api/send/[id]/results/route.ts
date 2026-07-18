import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const results = db
    .prepare("SELECT email, status, resend_message_id, error, attempts, updated_at FROM recipient_result WHERE job_id = ? ORDER BY batch_index")
    .all(id);
  return NextResponse.json({ results });
}
