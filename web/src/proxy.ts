import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic gate: no session cookie means no private pages. The API is the real check;
 * a stale cookie still reaches the page, which then sends the visitor to sign in.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has("retain_session")) {
    const next = request.nextUrl.pathname + request.nextUrl.search;
    const url = new URL("/login", request.url);
    url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/hr/:path*", "/me/:path*"],
};
