import type { Metadata } from "next";
import { Container, Section, SectionHeading, CtaLink } from "@/components/marketing/ui";
import { AuroraBackground } from "@/components/marketing/aurora-background";
import { BreadcrumbJsonLd, FaqJsonLd } from "@/components/marketing/json-ld";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Pricing",
  description:
    "nvault is free during early access. See what's included and how paid plans are expected to be structured.",
  path: "/pricing",
});

const tiers: ReadonlyArray<{
  name: string;
  price: string;
  cadence?: string;
  description: string;
  features: ReadonlyArray<string>;
  cta: { label: string; href: string };
  featured?: boolean;
}> = [
  {
    name: "Early access",
    price: "Free",
    description: "Everything in the vault while nvault is in early access.",
    features: [
      "Unlimited projects and files",
      "Full version history",
      "Zero-knowledge client-side encryption",
      "Device & session management",
      "Audit activity log",
    ],
    cta: { label: "Get started", href: "/register" },
    featured: true,
  },
  {
    name: "Pro",
    price: "TBD",
    cadence: "per user / month",
    description: "For individuals and small teams once general availability lands.",
    features: [
      "Everything in Early access",
      "Longer version retention",
      "Priority support",
      "CLI device management at scale",
    ],
    cta: { label: "Talk to us", href: "/contact" },
  },
  {
    name: "Team",
    price: "TBD",
    cadence: "per user / month",
    description: "Shared projects and access controls — planned, not yet available.",
    features: [
      "Everything in Pro",
      "Shared projects with per-member access",
      "Role-based permissions",
      "SSO (planned)",
    ],
    cta: { label: "Register interest", href: "/contact" },
  },
];

const pricingFaqs = [
  {
    question: "Is nvault really free right now?",
    answer:
      "Yes. During early access every feature of the vault is free with no card required. Paid plans will be introduced with advance notice and a free tier will remain.",
  },
  {
    question: "Will my data be affected when paid plans launch?",
    answer:
      "No. Stored files and their encrypted versions remain backwards compatible. We never silently change the encryption format in a way that makes previously stored files unrecoverable.",
  },
];

export default function PricingPage() {
  return (
    <>
      <BreadcrumbJsonLd items={[{ name: "Home", path: "/" }, { name: "Pricing", path: "/pricing" }]} />
      <FaqJsonLd items={pricingFaqs} />

      <Section className="relative isolate">
        <AuroraBackground />
        <Container>
          <SectionHeading
            eyebrow="Pricing"
            title="Free while we are in early access"
            description="Paid plans below are indicative and will be finalised before general availability. A free tier will always exist."
          />

          <div className="mt-16 grid gap-8 lg:grid-cols-3">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={
                  "flex flex-col rounded-2xl border p-6 " +
                  (tier.featured
                    ? "border-accent-500 bg-white shadow-lg dark:border-accent-500/60 dark:bg-slate-900"
                    : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900")
                }
              >
                {tier.featured && (
                  <span className="mb-3 inline-flex w-fit rounded-full bg-accent-50 px-2.5 py-0.5 text-xs font-semibold text-accent-700 dark:bg-accent-500/10 dark:text-accent-300">
                    Available now
                  </span>
                )}
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{tier.name}</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{tier.description}</p>
                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{tier.price}</span>
                  {tier.cadence && <span className="text-sm text-slate-500 dark:text-slate-400">{tier.cadence}</span>}
                </div>
                <ul className="mt-6 flex-1 space-y-3 text-sm">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex gap-2.5">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-accent-600 dark:text-accent-400" aria-hidden>
                        <path d="m20 6-11 11-5-5" />
                      </svg>
                      <span className="text-slate-600 dark:text-slate-300">{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  <CtaLink href={tier.cta.href} variant={tier.featured ? "primary" : "secondary"} className="w-full">
                    {tier.cta.label}
                  </CtaLink>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      <Section className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40">
        <Container>
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Pricing questions</h2>
            <dl className="mt-8 space-y-6">
              {pricingFaqs.map((faq) => (
                <div key={faq.question}>
                  <dt className="text-base font-semibold text-slate-900 dark:text-slate-100">{faq.question}</dt>
                  <dd className="mt-2 text-sm text-slate-600 dark:text-slate-300">{faq.answer}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Container>
      </Section>
    </>
  );
}
