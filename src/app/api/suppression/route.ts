import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { validateEmail } from "@/lib/validators";

export async function GET() {
  const db = getDb();
  const list = db.prepare("SELECT * FROM suppression ORDER BY created_at DESC").all();
  return NextResponse.json({ suppressions: list });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, reason } = body;

    if (!email || !validateEmail(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const validReasons = ["bounce", "unsubscribe", "manual"];
    if (!validReasons.includes(reason)) {
      return NextResponse.json({ error: "Invalid reason" }, { status: 400 });
    }

    const db = getDb();
    db.prepare(
      "INSERT OR REPLACE INTO suppression (email, reason, created_at) VALUES (?, ?, datetime('now'))"
    ).run(email.toLowerCase(), reason);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const db = getDb();
  db.prepare("DELETE FROM suppression WHERE email = ?").run(email.toLowerCase());
  return NextResponse.json({ ok: true });
}
