/**
 * Marketing-site configuration
 * ----------------------------
 * Single source of truth for the public-facing site: canonical URL, copy used
 * in metadata, navigation, and the footer. Keep this free of secrets — every
 * value here is shipped to the browser and embedded in crawlable markup.
 *
 * `SITE_URL` must be the production origin for the marketing site so that
 * canonical URLs, Open Graph tags, the sitemap, and robots.txt all resolve to
 * absolute URLs. Override per-environment with `NEXT_PUBLIC_SITE_URL`
 * (e.g. a preview deployment) — it must include the scheme and no trailing slash.
 */

function normalizeUrl(value: string | undefined, fallback: string): string {
  const raw = (value ?? fallback).trim();
  try {
    const url = new URL(raw);
    return url.origin;
  } catch {
    return fallback;
  }
}

export const SITE_URL = normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL, "https://nvault.dev");

export const siteConfig = {
  name: "nvault",
  /** Used in <title> templates and structured data. */
  shortName: "nvault",
  url: SITE_URL,
  tagline: "Your development environment, available anywhere.",
  description:
    "nvault is a zero-knowledge vault for your .env and project configuration files. " +
    "Encrypt in the browser, store ciphertext only, and restore your environment on any machine.",
  /** Kept short — search engines truncate around 155–160 characters. */
  metaDescription:
    "Zero-knowledge vault for .env files. Client-side encryption, versioned history, " +
    "and one-command restore on any machine. The server never sees plaintext.",
  keywords: [
    "env vault",
    "dotenv manager",
    "secrets management",
    "environment variables",
    "zero-knowledge encryption",
    "developer tools",
    "secure config storage",
    ".env backup",
    "secret storage",
  ],
  creator: "nvault",
  locale: "en_US",
  /** Public support / contact address surfaced in structured data and the footer. */
  contactEmail: "hello@nvault.dev",
  ogImageAlt: "nvault — your development environment, available anywhere.",
} as const;

/** Primary navigation shown in the marketing header. */
export const marketingNav: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/features", label: "Features" },
  { href: "/security", label: "Security" },
  { href: "/cli", label: "CLI" },
  { href: "/blog", label: "Blog" },
  { href: "/pricing", label: "Pricing" },
  { href: "/faq", label: "FAQ" },
];

/** Footer link groups. */
export const footerNav: ReadonlyArray<{
  title: string;
  links: ReadonlyArray<{ href: string; label: string; external?: boolean }>;
}> = [
  {
    title: "Product",
    links: [
      { href: "/features", label: "Features" },
      { href: "/security", label: "Security" },
      { href: "/cli", label: "CLI" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/blog", label: "Blog" },
      { href: "/faq", label: "FAQ" },
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
];

/**
 * Paths that must never be indexed: everything behind authentication and the
 * API. Consumed by `robots.ts` and `sitemap.ts`.
 */
export const noIndexPaths: ReadonlyArray<string> = [
  "/api/",
  "/dashboard",
  "/projects",
  "/settings",
  "/login",
  "/register",
];
