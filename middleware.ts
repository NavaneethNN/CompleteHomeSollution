import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * SEC-2 fix: Middleware now decodes and verifies the NextAuth JWT to extract
 * the user's role before granting access to admin routes.
 *
 * Previous behaviour: only checked that a session cookie existed.
 * Any authenticated non-admin user could reach /admin/* pages and
 * /api/admin/* endpoints — protection relied solely on per-page checks.
 *
 * Current behaviour:
 *  - /admin/*       → must be authenticated + role === "ADMIN"
 *  - /api/admin/*   → must be authenticated + role === "ADMIN" (returns 403 JSON, no redirect)
 *  - /account/*     → must be authenticated (any role)
 */

const ADMIN_ROLE = "ADMIN";

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Decode the JWT using the AUTH_SECRET. getToken returns null when:
  //   • no session cookie exists
  //   • the cookie exists but the signature is invalid / token is expired
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    // next-auth v5 uses the cookie name set in auth.ts cookies config
    cookieName:
      process.env.NODE_ENV === "production"
        ? "__Secure-authjs.session-token"
        : "authjs.session-token",
  });

  const isLoggedIn = !!token;
  const isAdmin = token?.role === ADMIN_ROLE;

  // ── /api/admin/* ── return JSON 401/403 (not a redirect) so fetch() callers
  //                    receive a structured error rather than an HTML login page.
  if (pathname.startsWith("/api/admin")) {
    if (!isLoggedIn) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.next();
  }

  // ── /admin/* ── redirect unauthenticated users to login; redirect authenticated
  //               non-admins to home with an "access denied" notice.
  if (pathname.startsWith("/admin")) {
    if (!isLoggedIn) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (!isAdmin) {
      // User is logged in but not an admin — send them home
      return NextResponse.redirect(new URL("/?error=AccessDenied", req.url));
    }
    return NextResponse.next();
  }

  // ── /account/* ── any authenticated user allowed
  if (pathname.startsWith("/account")) {
    if (!isLoggedIn) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  // Extend matcher to cover /api/admin/* so those routes are also protected
  // at the middleware layer — not just by in-route auth() checks.
  matcher: ["/admin/:path*", "/api/admin/:path*", "/account/:path*"],
};
