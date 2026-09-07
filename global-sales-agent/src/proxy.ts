import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ["/login", "/api/auth", "/api/health", "/api/demo/marketplace", "/api/webhooks"];
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Next.js proxy (middleware): auth guard for app pages & API, CSRF origin check for mutating API calls.
 */
export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const isApi = pathname.startsWith("/api/");

  // CSRF: same-origin check for state-changing API requests (webhooks are signature-verified instead)
  if (isApi && MUTATING.has(req.method) && !pathname.startsWith("/api/webhooks") && !pathname.startsWith("/api/auth") && !pathname.startsWith("/api/demo/marketplace")) {
    const origin = req.headers.get("origin");
    const fetchSite = req.headers.get("sec-fetch-site");
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
    if (fetchSite === "cross-site") return NextResponse.json({ ok: false, error: "Cross-site request blocked" }, { status: 403 });
    if (origin) {
      try {
        if (new URL(origin).host !== host) return NextResponse.json({ ok: false, error: "Origin mismatch" }, { status: 403 });
      } catch {
        return NextResponse.json({ ok: false, error: "Invalid origin" }, { status: 403 });
      }
    }
  }

  if (isPublic) return NextResponse.next();
  if (!req.auth?.user) {
    if (isApi) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (pathname === "/login") return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images|video|.*\\.(?:png|jpg|jpeg|svg|webp|ico|css|js|map)$).*)"],
};
