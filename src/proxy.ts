import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// TEMPORARY internal-testing gate — NOT real security. It only checks a
// password against an env var and sets a cookie; it doesn't authenticate a
// specific person, rate-limit attempts, or protect anything server-side
// beyond this app's own pages/routes. Once data is migrated to Supabase,
// that data needs its own Row Level Security policies regardless of this
// gate — anyone who finds the Supabase API keys (which are meant to be
// public/client-exposed) can hit the database directly, bypassing this
// entirely. Remove this file (and /login, /api/login) once real auth
// exists or this app is no longer being shared for testing.
export const UNLOCK_COOKIE_NAME = "yhtbt_unlocked";

// The login page and its API route must stay reachable without the
// cookie — otherwise there'd be no way to ever set it. Static assets are
// excluded via the matcher below instead of here.
const PUBLIC_PATHS = ["/login", "/api/login"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const isUnlocked = request.cookies.get(UNLOCK_COOKIE_NAME)?.value === "1";
  if (isUnlocked) {
    return NextResponse.next();
  }

  // Preserves the originally requested URL (path + query) so /login can
  // send the visitor on to wherever they were actually headed — including
  // a deep link like /experiences/[id], not just the homepage — once they
  // enter the correct password.
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set(
    "next",
    pathname + request.nextUrl.search
  );
  return NextResponse.redirect(loginUrl);
}

// No matcher exclusions for app routes — every page and API route is
// gated by default, which is the point (a deep link like
// /experiences/[id] must be caught here just as much as "/"). Only
// Next.js's own static/image infrastructure and the favicon are excluded,
// matching Next's own recommended default exclusion list — those aren't
// app content, and gating them would break asset loading on the login
// page itself.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
