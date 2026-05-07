import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Lightweight middleware - checks for session cookie only
// Full auth validation happens in page components
export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const sessionCookie = req.cookies.get("authjs.session-token") || req.cookies.get("__Secure-authjs.session-token");
  const isLoggedIn = !!sessionCookie;

  if (pathname.startsWith("/admin")) {
    // Admin check happens in page component - just redirect if no session
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  if (pathname.startsWith("/account")) {
    if (!isLoggedIn) {
      const callbackUrl = encodeURIComponent(pathname);
      return NextResponse.redirect(
        new URL(`/login?callbackUrl=${callbackUrl}`, req.url)
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/account/:path*"],
};
