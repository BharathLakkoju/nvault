/** @type {import('next').NextConfig} */

// Static CSP for marketing/legal pages (no per-request nonce — keeps SSG).
// Authenticated app routes and /api/v1/* receive a nonce policy from src/proxy.ts.
const marketingCsp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data:",
  "font-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""),
  "connect-src 'self'",
  "object-src 'none'",
].join("; ");

const baseSecurityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // argon2 (native) and the Prisma runtime + pg driver must not be bundled
  // for server code.
  serverExternalPackages: [
    "@node-rs/argon2",
    "@prisma/client",
    "@prisma/adapter-pg",
    "@simplewebauthn/server",
    "pg",
  ],
  experimental: {
    // Tree-shakes lucide-react icon imports in route bundles.
    optimizePackageImports: ["lucide-react"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: baseSecurityHeaders },
      {
        // Everything except app surfaces covered by src/proxy.ts.
        source:
          "/((?!api/v1|dashboard|settings|organizations|projects|login|register|invite).*)",
        headers: [{ key: "Content-Security-Policy", value: marketingCsp }],
      },
    ];
  },
};

export default nextConfig;
