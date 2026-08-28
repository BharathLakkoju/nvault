import { siteConfig, SITE_URL } from "@/lib/site";

/**
 * Renders a JSON-LD `<script>` block. The CSP allows inline scripts
 * (`script-src 'self' 'unsafe-inline'`), so no nonce is required. Input is a
 * plain object we control — never user data.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/** Organisation + WebSite graph, rendered once in the marketing layout. */
export function OrganizationJsonLd() {
  return (
    <JsonLd
      data={[
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          "@id": `${SITE_URL}/#organization`,
          name: siteConfig.name,
          url: SITE_URL,
          logo: `${SITE_URL}/icon`,
          description: siteConfig.description,
          email: siteConfig.contactEmail,
        },
        {
          "@context": "https://schema.org",
          "@type": "WebSite",
          "@id": `${SITE_URL}/#website`,
          url: SITE_URL,
          name: siteConfig.name,
          description: siteConfig.metaDescription,
          publisher: { "@id": `${SITE_URL}/#organization` },
        },
      ]}
    />
  );
}

/** SoftwareApplication schema for the product — used on the home page. */
export function SoftwareApplicationJsonLd() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: siteConfig.name,
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Web, macOS, Linux, Windows",
        description: siteConfig.description,
        url: SITE_URL,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
      }}
    />
  );
}

export function FaqJsonLd({ items }: { items: ReadonlyArray<{ question: string; answer: string }> }) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: items.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      }}
    />
  );
}

export function BreadcrumbJsonLd({ items }: { items: ReadonlyArray<{ name: string; path: string }> }) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: item.name,
          item: new URL(item.path, SITE_URL).toString(),
        })),
      }}
    />
  );
}
