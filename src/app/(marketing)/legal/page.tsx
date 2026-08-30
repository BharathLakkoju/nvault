import type { Metadata } from "next";
import Link from "next/link";
import { Container, Section } from "@/components/marketing/ui";
import { BreadcrumbJsonLd } from "@/components/marketing/json-ld";
import { pageMetadata } from "@/lib/seo";
import { legalConfig } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Legal & Compliance",
  description:
    "Every nvault policy in one place: privacy, terms, refunds and cancellation, acceptable use, cookies, sub-processors, and data processing.",
  path: "/legal",
});

const documents: ReadonlyArray<{ href: string; title: string; summary: string }> = [
  {
    href: "/privacy",
    title: "Privacy Policy",
    summary:
      "What data we collect, why, how long we keep it, and your rights under India's DPDP Act, the GDPR and the CCPA. The vault is zero-knowledge — we cannot read your file contents.",
  },
  {
    href: "/terms",
    title: "Terms of Service",
    summary:
      "The agreement between you and nvault: accounts, acceptable use, subscriptions, warranties, liability, and the governing law.",
  },
  {
    href: "/refunds",
    title: "Refunds & Cancellation Policy",
    summary:
      "How to cancel a Pro or Team subscription, when refunds are issued, and how billing is handled by our Merchant of Record.",
  },
  {
    href: "/acceptable-use",
    title: "Acceptable Use Policy",
    summary: "What you may and may not do with nvault, and how we respond to abuse.",
  },
  {
    href: "/cookies",
    title: "Cookie Policy",
    summary: "nvault uses a small number of strictly-necessary cookies and no third-party tracking or analytics.",
  },
  {
    href: "/subprocessors",
    title: "Sub-processors",
    summary: "The infrastructure providers that process encrypted data and account metadata on our behalf.",
  },
  {
    href: "/dpa",
    title: "Data Processing Addendum",
    summary:
      "For organizations that need a processor agreement: roles, security measures, sub-processing, international transfers, and breach notification.",
  },
];

export default function LegalIndexPage() {
  return (
    <>
      <BreadcrumbJsonLd items={[{ name: "Home", path: "/" }, { name: "Legal", path: "/legal" }]} />
      <Section>
        <Container>
          <div className="mx-auto max-w-3xl">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Legal &amp; Compliance</h1>
            <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
              The policies below govern your use of nvault. They are written in plain language and kept consistent with
              how the product actually works.
            </p>

            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300">
              <p className="font-semibold text-slate-900 dark:text-slate-100">Who operates nvault</p>
              <dl className="mt-3 space-y-1.5">
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-medium text-slate-700 dark:text-slate-200">Operated by:</dt>
                  <dd>
                    {legalConfig.operatorName} — {legalConfig.operatorType}
                  </dd>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-medium text-slate-700 dark:text-slate-200">Location:</dt>
                  <dd>
                    {legalConfig.operatorAddress || legalConfig.operatorLocation}
                  </dd>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-medium text-slate-700 dark:text-slate-200">Support:</dt>
                  <dd>
                    <a
                      href={`mailto:${legalConfig.supportEmail}`}
                      className="font-medium text-accent-600 hover:underline dark:text-accent-400"
                    >
                      {legalConfig.supportEmail}
                    </a>
                  </dd>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-medium text-slate-700 dark:text-slate-200">Privacy / data protection:</dt>
                  <dd>
                    <a
                      href={`mailto:${legalConfig.privacyEmail}`}
                      className="font-medium text-accent-600 hover:underline dark:text-accent-400"
                    >
                      {legalConfig.privacyEmail}
                    </a>
                  </dd>
                </div>
              </dl>
            </div>

            <ul className="mt-8 divide-y divide-slate-200 dark:divide-slate-800">
              {documents.map((doc) => (
                <li key={doc.href} className="py-5 first:pt-0">
                  <Link
                    href={doc.href}
                    className="focus-ring group block rounded-lg p-2 -mx-2 hover:bg-slate-50 dark:hover:bg-slate-900"
                  >
                    <span className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
                      {doc.title}
                      <span
                        aria-hidden
                        className="text-accent-600 transition-transform group-hover:translate-x-0.5 dark:text-accent-400"
                      >
                        →
                      </span>
                    </span>
                    <span className="mt-1 block text-sm text-slate-600 dark:text-slate-300">{doc.summary}</span>
                  </Link>
                </li>
              ))}
            </ul>

            <p className="mt-10 text-sm text-slate-500 dark:text-slate-400">
              Effective {legalConfig.effectiveDate}. We will announce material changes in the app or by email and update
              the effective date on each document.
            </p>
          </div>
        </Container>
      </Section>
    </>
  );
}
