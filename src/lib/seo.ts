import type { Metadata } from "next";
import { siteConfig, SITE_URL } from "@/lib/site";

interface PageSeoInput {
  /** Page title without the site-name suffix (the layout template adds it). */
  title: string;
  description: string;
  /** Absolute path beginning with "/". Used for the canonical URL. */
  path: string;
  /** Set true for utility pages that should not appear in search results. */
  noIndex?: boolean;
  /** Override the default Open Graph type (defaults to "website"). */
  ogType?: "website" | "article";
}

/**
 * Builds a consistent `Metadata` object for a marketing page: canonical URL,
 * Open Graph, and Twitter tags derived from one short input. The root layout
 * supplies `metadataBase`, the title template, and the default OG/Twitter
 * image, so pages only need to state what is specific to them.
 */
/** Absolute URL of the generated social-share card (see app/opengraph-image.tsx). */
export const OG_IMAGE = {
  url: new URL("/opengraph-image", SITE_URL).toString(),
  width: 1200,
  height: 630,
  alt: siteConfig.ogImageAlt,
};

export function pageMetadata({ title, description, path, noIndex, ogType = "website" }: PageSeoInput): Metadata {
  const canonical = new URL(path, SITE_URL).toString();

  return {
    title,
    description,
    alternates: { canonical },
    ...(noIndex ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      type: ogType,
      url: canonical,
      title: `${title} — ${siteConfig.name}`,
      description,
      siteName: siteConfig.name,
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} — ${siteConfig.name}`,
      description,
      images: [OG_IMAGE.url],
    },
  };
}
