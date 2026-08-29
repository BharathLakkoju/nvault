import type { Metadata } from "next";
import { Container, Section, SectionHeading } from "@/components/marketing/ui";
import { AuroraBackground } from "@/components/aurora-background";
import { BreadcrumbJsonLd } from "@/components/marketing/json-ld";
import { pageMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Contact",
  description: "Get in touch with the nvault team about the product, security, or partnership enquiries.",
  path: "/contact",
});

const channels: ReadonlyArray<{ label: string; value: string; href: string; note: string }> = [
  {
    label: "General & product",
    value: siteConfig.contactEmail,
    href: `mailto:${siteConfig.contactEmail}`,
    note: "Questions, feedback, and plan enquiries.",
  },
  {
    label: "Security",
    value: "security@nvault.dev",
    href: "mailto:security@nvault.dev",
    note: "Vulnerability reports and responsible disclosure.",
  },
];

export default function ContactPage() {
  return (
    <>
      <BreadcrumbJsonLd items={[{ name: "Home", path: "/" }, { name: "Contact", path: "/contact" }]} />
      <Section className="relative isolate">
        <AuroraBackground />
        <Container>
          <SectionHeading
            eyebrow="Contact"
            title="Get in touch"
            description="We read every message. Please do not include secrets, API keys or .env contents in an email."
          />

          <div className="mx-auto mt-14 grid max-w-2xl gap-6 sm:grid-cols-2">
            {channels.map((channel) => (
              <div
                key={channel.label}
                className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
              >
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{channel.label}</h2>
                <a
                  href={channel.href}
                  className="focus-ring mt-2 inline-block rounded font-medium text-accent-600 hover:underline dark:text-accent-400"
                >
                  {channel.value}
                </a>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{channel.note}</p>
              </div>
            ))}
          </div>
        </Container>
      </Section>
    </>
  );
}
