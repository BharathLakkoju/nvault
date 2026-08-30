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

/**
 * Legal / compliance configuration
 * --------------------------------
 * Single source of truth for the disclosures that the Terms, Privacy Policy,
 * and Refund & Cancellation Policy pages depend on.
 *
 * nvault is currently run by one person in India as an individual — there is no
 * registered company, and (below the ₹20 lakh services threshold) no GST
 * registration. The pages cover the Digital Personal Data Protection Act, 2023,
 * the Information Technology Act, 2000 (and the SPDI Rules, 2011), plus the
 * GDPR / UK GDPR and CCPA/CPRA for users outside India. A formal grievance-
 * officer page is deliberately NOT published while the project is pre-revenue;
 * complaints route to the support / privacy addresses instead.
 *
 * `operatorName` is a bracketed placeholder — set your real name before launch,
 * here or via `NEXT_PUBLIC_LEGAL_OPERATOR_NAME`. `operatorAddress` is OPTIONAL:
 * leave it unset while nvault is a personal project and the pages fall back to
 * city/state/country plus an email contact; set it (e.g. to a residential or
 * correspondence address) if and when you take meaningful consumer revenue.
 * Every value here ships to the browser — keep it free of anything sensitive.
 */
const operatorAddressEnv = process.env.NEXT_PUBLIC_LEGAL_OPERATOR_ADDRESS?.trim();

export const legalConfig = {
  /** The name nvault is operated under. */
  operatorName: process.env.NEXT_PUBLIC_LEGAL_OPERATOR_NAME ?? "[Your name]",
  /** How the operator is described — an individual, not a registered entity. */
  operatorType: "an individual (sole operator; not a registered company)",
  /** Short descriptor used in running prose. */
  operatorDescriptor: "an independent developer based in Hyderabad, India",
  /** City / state / country — always shown; used when no postal address is set. */
  operatorLocation: "Hyderabad, Telangana, India",
  /**
   * Optional postal address. Empty string = not published (personal-project
   * phase). Set it once nvault takes real consumer revenue.
   */
  operatorAddress: operatorAddressEnv && operatorAddressEnv.length > 0 ? operatorAddressEnv : "",
  jurisdictionCity: "Hyderabad",
  jurisdictionState: "Telangana",
  jurisdictionCountry: "India",
  governingLaw: "the laws of India",
  /** Privacy / data-protection contact. Acts as the DPDP point of contact. */
  privacyEmail: "privacy@nvault.dev",
  supportEmail: "hello@nvault.dev",
  securityEmail: "security@nvault.dev",
  /** Payments are handled by a Merchant of Record — nvault never sees card data. */
  merchantOfRecord: "Polar",
  merchantOfRecordUrl: "https://polar.sh",
  merchantOfRecordTerms: "https://polar.sh/legal/terms",
  /** Date the current versions of the legal pages take effect. */
  effectiveDate: "30 August 2026",
} as const;

/** "Nnn, City, State, Country" when an address is set; otherwise just the location. */
export function operatorPostalLine(): string {
  return legalConfig.operatorAddress
    ? `${legalConfig.operatorAddress}`
    : `${legalConfig.operatorLocation} (no public postal address while nvault is a personal project — reach us by email)`;
}

/**
 * Third parties that process encrypted data or account metadata on nvault's
 * behalf. Surfaced on `/subprocessors` and referenced by the Privacy Policy and
 * DPA. The database host depends on the deployment (see DEPLOYMENT.md) — set
 * `NEXT_PUBLIC_DB_PROVIDER` to the one actually in use.
 */
export const subprocessors: ReadonlyArray<{
  name: string;
  purpose: string;
  data: string;
  location: string;
}> = [
  {
    name: "Vercel Inc.",
    purpose: "Application hosting, edge network, and scheduled jobs",
    data: "Encrypted request/response traffic, minimal operational logs (no secret values)",
    location: "United States (global edge)",
  },
  {
    name: process.env.NEXT_PUBLIC_DB_PROVIDER ?? "Managed Postgres provider (e.g. Neon or Supabase)",
    purpose: "Primary database — stores encrypted file blobs, wrapped keys and account metadata",
    data: "Ciphertext file versions, wrapped encryption keys, account and organization metadata, audit records",
    location: "Configured per deployment; choose a region close to your users",
  },
  {
    name: "Polar Software Inc. (Polar)",
    purpose: "Merchant of Record — checkout, subscription billing, invoicing and tax",
    data: "Name, email, billing address, payment card data (held by Polar, never by nvault), subscription records",
    location: "United States / European Union",
  },
];

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
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms of Service" },
      { href: "/refunds", label: "Refunds & Cancellation" },
      { href: "/acceptable-use", label: "Acceptable Use" },
      { href: "/cookies", label: "Cookie Policy" },
      { href: "/legal", label: "All policies" },
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
