import { NextRequest, NextResponse } from "next/server";

export function checkAuth(request: NextRequest): NextResponse | null {
  const password = process.env.APP_PASSWORD;
  if (!password) return null;

  const authHeader = request.headers.get("authorization");
  if (!authHeader || authHeader !== `Bearer ${password}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
