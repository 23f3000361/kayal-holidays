import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic gate only: bounce visitors without a session cookie away from staff pages.
 * Real authorisation happens on the server in every page and action (see server/auth.ts).
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has("kayal_session")) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/account"] };
