import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { countHit, findRedirect } from "@/server/redirect-cache";

/**
 * 1. Old-site URLs: permanent (308) redirects managed in the admin, so rankings move across.
 * 2. Optimistic gate: visitors without a session cookie are sent to sign in before staff pages.
 *    Real authorisation happens on the server in every page and action (see server/auth.ts).
 */
export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const { pathname, search } = request.nextUrl;

  if ((pathname.startsWith("/admin") || pathname === "/account") && !request.cookies.has("kayal_session")) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const hit = await findRedirect(pathname, search);
  if (hit) {
    event.waitUntil(countHit(pathname, search));
    return NextResponse.redirect(new URL(hit.to, request.url), 308);
  }
  return NextResponse.next();
}

export const config = {
  // Everything except framework assets, images and APIs.
  matcher: ["/((?!_next/static|_next/image|api/|media/|photos/|favicon.ico|robots.txt|sitemap.xml).*)"],
};
