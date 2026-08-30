import type { Metadata } from "next";
import { Container, Section, SectionHeading } from "@/components/marketing/ui";
import { AuroraBackground } from "@/components/aurora-background";
import { BreadcrumbJsonLd } from "@/components/marketing/json-ld";
import { pageMetadata } from "@/lib/seo";
import { legalConfig, siteConfig } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Contact",
  description: "Get in touch with nvault about the product, security, billing, or a privacy request.",
  path: "/contact",
});

const channels: ReadonlyArray<{ label: string; value: string; href: string; note: string }> = [
  {
    label: "General & product",
    value: siteConfig.contactEmail,
    href: `mailto:${siteConfig.contactEmail}`,
    note: "Questions, feedback, plan enquiries, and billing.",
  },
  {
    label: "Security",
    value: legalConfig.securityEmail,
    href: `mailto:${legalConfig.securityEmail}`,
    note: "Vulnerability reports and responsible disclosure.",
  },
  {
    label: "Privacy & data protection",
    value: legalConfig.privacyEmail,
    href: `mailto:${legalConfig.privacyEmail}`,
    note: "Access, correction, deletion and export requests, and privacy complaints.",
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

          <div className="mx-auto mt-10 max-w-2xl rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Operator details</h2>
            <p className="mt-2">
              nvault is operated by {legalConfig.operatorName} ({legalConfig.operatorType}), based in{" "}
              {legalConfig.operatorLocation}.
              {legalConfig.operatorAddress ? (
                <>
                  <br />
                  {legalConfig.operatorAddress}
                </>
              ) : null}
            </p>
            <p className="mt-3">
              The policies that govern your use of nvault are on the{" "}
              <a href="/legal" className="font-medium text-accent-600 hover:underline dark:text-accent-400">
                Legal &amp; Compliance
              </a>{" "}
              page.
            </p>
          </div>
        </Container>
      </Section>
    </>
  );
}
