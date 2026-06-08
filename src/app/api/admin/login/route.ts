import { NextResponse } from "next/server";
import {
  createAdminToken,
  getAdminCookieName,
  getAdminCookieOptions,
  verifyAdminCredentials
} from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };
  const email = body.email?.trim() ?? "";
  const password = body.password ?? "";
  const verified = verifyAdminCredentials(email, password);

  if (!verified.ok) {
    return NextResponse.json({ error: verified.message }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    getAdminCookieName(),
    createAdminToken(email),
    getAdminCookieOptions()
  );
  return response;
}
