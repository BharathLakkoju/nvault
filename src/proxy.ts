import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Per-request CSP with a cryptographic nonce for authenticated app surfaces.
 * Marketing/legal pages keep the static policy from next.config.mjs so they can
 * stay statically generated; this proxy opts matched routes into dynamic
 * rendering via the forwarded x-nonce header (read in the root layout).
 */
function buildNonceCsp(nonce: string): string {
  const devEval = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data:",
    "font-src 'self'",
    // Styles stay permissive: React/Radix/Next inject <style> tags and inline
    // style attributes at runtime without access to the per-request nonce.
    // Script execution remains nonce-gated below — that is the XSS boundary.
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${devEval}`,
    "connect-src 'self'",
    "object-src 'none'",
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = randomBytes(16).toString("base64");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", buildNonceCsp(nonce));
  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/settings/:path*",
    "/organizations/:path*",
    "/projects/:path*",
    "/login",
    "/register",
    "/invite/:path*",
    "/api/v1/:path*",
  ],
};
