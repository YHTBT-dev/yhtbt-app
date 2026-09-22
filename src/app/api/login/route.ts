import { NextResponse } from "next/server";
import { UNLOCK_COOKIE_NAME } from "@/proxy";

// TEMPORARY internal-testing gate — see the comment at the top of
// proxy.ts. This route only checks a shared password against an env var
// and sets a cookie; it's not real authentication (no per-person identity,
// no rate limiting) and doesn't substitute for Supabase Row Level
// Security once the app's data actually lives there.
export async function POST(request: Request) {
  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const expectedPassword = process.env.ADMIN_TEST_PASSWORD;
  if (!expectedPassword) {
    console.error("[api/login] ADMIN_TEST_PASSWORD is not set.");
    return NextResponse.json(
      { error: "Login is not configured on the server yet." },
      { status: 500 }
    );
  }

  if (body.password !== expectedPassword) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(UNLOCK_COOKIE_NAME, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // No maxAge/expires — a session cookie, cleared when the browser
    // fully closes, matching "don't re-prompt within this session".
  });
  return response;
}
