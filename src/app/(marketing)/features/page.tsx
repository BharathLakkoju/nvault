import type { Metadata } from "next";
import { Container, Section, SectionHeading, CtaLink } from "@/components/marketing/ui";
import { AuroraBackground } from "@/components/aurora-background";
import { BreadcrumbJsonLd } from "@/components/marketing/json-ld";
import { features } from "@/lib/marketing-content";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Features",
  description:
    "Zero-knowledge encryption, project organisation, versioned history, exact-fidelity storage, one-command restore, and full device and audit controls.",
  path: "/features",
});

const detailed: ReadonlyArray<{ heading: string; body: string }> = [
  {
    heading: "Preserve files exactly as written",
    body:
      "nvault stores configuration files as opaque blobs. It does not assume dotenv syntax, so comments, inline quotes, multiline values, key ordering, trailing whitespace and file encoding all survive a round trip unchanged.",
  },
  {
    heading: "Version every change",
    body:
      "Each push creates an immutable version with its own metadata. Browse the history for any file, download an earlier version, or promote it back to current — useful when a config edit silently breaks local development.",
  },
  {
    heading: "Restore by Git remote",
    body:
      "The CLI reads the Git remote of the current directory and matches it to a project, so 'nvault init' in a fresh clone knows exactly which environment to restore. Git is never required — you can always select a project explicitly.",
  },
  {
    heading: "Safe by default on write",
    body:
      "Restoring never silently overwrites a local file. You are shown what will change and asked to confirm, with a backup strategy for anything already on disk.",
  },
  {
    heading: "Manage devices and sessions",
    body:
      "Every authenticated session is listed with its device and last-seen time. Revoke any one, or all others, immediately. Access tokens are short-lived and refresh independently.",
  },
  {
    heading: "Audit trail without secrets",
    body:
      "Security-sensitive actions — logins, session revocations, project and file changes — are recorded with timestamps. Secret contents are never included in an audit entry or a log line.",
  },
];

export default function FeaturesPage() {
  return (
    <>
      <BreadcrumbJsonLd items={[{ name: "Home", path: "/" }, { name: "Features", path: "/features" }]} />
      <Section className="relative isolate">
        <AuroraBackground />
        <Container>
          <SectionHeading
            eyebrow="Features"
            title="Built for how environment config actually changes"
            description="Often, across many machines, and in ways that can break a working setup. nvault is a secure vault for that reality — not generic cloud storage."
          />

          <div className="mt-16 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title}>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-50 text-accent-600 dark:bg-accent-500/10 dark:text-accent-400">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d={feature.icon} />
                  </svg>
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-100">{feature.title}</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{feature.description}</p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      <Section className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40">
        <Container>
          <div className="mx-auto max-w-3xl space-y-12">
            {detailed.map((item) => (
              <div key={item.heading}>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{item.heading}</h2>
                <p className="mt-3 text-slate-600 dark:text-slate-300">{item.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-14 text-center">
            <CtaLink href="/register">Get started free</CtaLink>
          </div>
        </Container>
      </Section>
    </>
  );
}
