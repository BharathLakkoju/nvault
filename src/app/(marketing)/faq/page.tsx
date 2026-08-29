import type { Metadata } from "next";
import { Container, Section, SectionHeading, CtaLink } from "@/components/marketing/ui";
import { AuroraBackground } from "@/components/marketing/aurora-background";
import { BreadcrumbJsonLd, FaqJsonLd } from "@/components/marketing/json-ld";
import { faqs } from "@/lib/marketing-content";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "FAQ",
  description:
    "Answers to common questions about nvault: zero-knowledge encryption, passphrase recovery, file fidelity, versioning, the CLI, and pricing.",
  path: "/faq",
});

export default function FaqPage() {
  return (
    <>
      <BreadcrumbJsonLd items={[{ name: "Home", path: "/" }, { name: "FAQ", path: "/faq" }]} />
      <FaqJsonLd items={faqs} />

      <Section className="relative isolate">
        <AuroraBackground />
        <Container>
          <SectionHeading eyebrow="FAQ" title="Frequently asked questions" />

          <dl className="mx-auto mt-14 max-w-3xl divide-y divide-slate-200 dark:divide-slate-800">
            {faqs.map((faq) => (
              <div key={faq.question} className="py-6 first:pt-0">
                <dt className="text-lg font-semibold text-slate-900 dark:text-slate-100">{faq.question}</dt>
                <dd className="mt-3 text-slate-600 dark:text-slate-300">{faq.answer}</dd>
              </div>
            ))}
          </dl>

          <div className="mx-auto mt-12 max-w-3xl text-center">
            <p className="text-slate-600 dark:text-slate-300">Still have a question?</p>
            <div className="mt-4">
              <CtaLink href="/contact" variant="secondary">
                Contact us
              </CtaLink>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
