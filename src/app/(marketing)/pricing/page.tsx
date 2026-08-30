import type { Metadata } from "next";
import { Container, Section, SectionHeading, CtaLink } from "@/components/marketing/ui";
import { AuroraBackground } from "@/components/aurora-background";
import { BreadcrumbJsonLd, FaqJsonLd } from "@/components/marketing/json-ld";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Pricing",
  description:
    "nvault is free for personal use. Organizations are a paid Team plan — one subscription per organization, billed through Polar.",
  path: "/pricing",
});

const tiers: ReadonlyArray<{
  name: string;
  /** Small lead-in before the price, e.g. "from". */
  pricePrefix?: string;
  price: string;
  cadence?: string;
  description: string;
  features: ReadonlyArray<string>;
  cta: { label: string; href: string };
  featured?: boolean;
}> = [
  {
    name: "Free",
    price: "$0",
    description: "Everything you need to try nvault for personal use.",
    features: [
      "Up to 3 personal projects",
      "The last 2 versions of each file",
      "2 browser sessions + 1 CLI token",
      "Zero-knowledge client-side encryption",
      "Web app + terminal CLI (push, pull, init, run)",
    ],
    cta: { label: "Get started", href: "/register" },
  },
  {
    name: "Pro",
    price: "$10",
    cadence: "per user / month",
    description: "For individuals who live in their environment files.",
    features: [
      "Unlimited personal projects",
      "Unlimited version history",
      "More devices — 5 browser sessions + 5 CLI tokens",
      "Advanced features as they ship",
      "Priority support",
    ],
    cta: { label: "Start with Pro", href: "/register" },
    featured: true,
  },
  {
    name: "Team",
    pricePrefix: "from",
    price: "$29",
    cadence: "per organization / month",
    description: "Collaboration and organization control for a whole team.",
    features: [
      "Shared, zero-knowledge projects across the org",
      "Owner / admin / member roles",
      "Per-organization key with member rotation",
      "Organization activity log",
      "Starter $29 · Growth $79 · Scale $199 (10 / 25 / 100 members)",
      "One flat price per org — no per-seat charges",
    ],
    cta: { label: "Start an organization", href: "/register" },
  },
];

const pricingFaqs = [
  {
    question: "Is nvault free for personal use?",
    answer:
      "Yes. The Free plan gives you a personal vault with up to 3 projects, the last 2 versions of each file, and 2 signed-in devices — no card required. It is meant for trying nvault and light personal use. Everything is end-to-end encrypted in your browser on every tier.",
  },
  {
    question: "What does “limited history” mean on Free?",
    answer:
      "Free keeps the two most recent versions of each file, and that ceiling counts every version ever uploaded — deleting an old one does not free up room. Pro ($10/month) removes the cap entirely: unlimited version history, plus unlimited projects and more devices.",
  },
  {
    question: "How does billing work?",
    answer:
      "Pro is a per-user subscription. Team is one flat subscription per organization in one of three size tiers (Starter $29 / Growth $79 / Scale $199), and you can move between them any time — Polar prorates the difference. Both are billed through Polar, our Merchant of Record, on Polar-hosted pages; nvault never sees or stores your card details, and Polar handles invoicing and tax. Cancel any time from Settings → Billing. See the Refunds & Cancellation Policy for how refunds work.",
  },
  {
    question: "What happens to an organization if its subscription lapses?",
    answer:
      "It becomes read-only — you and your team can still pull existing environment files, but not push new ones or add projects — until the subscription is renewed. Your data is never deleted for non-payment.",
  },
  {
    question: "Will my data be affected by plan changes?",
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
            title="Free to start. Simple when you grow."
            description="Free is for trying nvault and personal use. Pro removes every limit for one person. Team adds collaboration and organization control at one flat price each. Billed through Polar."
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
                    Most popular
                  </span>
                )}
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{tier.name}</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{tier.description}</p>
                <div className="mt-4 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                  {tier.pricePrefix && (
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {tier.pricePrefix}
                    </span>
                  )}
                  <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    {tier.price}
                  </span>
                  {tier.cadence && (
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {tier.cadence}
                    </span>
                  )}
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
