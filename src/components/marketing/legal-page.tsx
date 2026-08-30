import type { ReactNode } from "react";
import Link from "next/link";
import { Container, Section, Prose } from "@/components/marketing/ui";
import { BreadcrumbJsonLd } from "@/components/marketing/json-ld";
import { legalConfig } from "@/lib/site";

/** Every policy page, so users can move between them without hunting in the footer. */
export const legalPages: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/legal", label: "Overview" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/refunds", label: "Refunds & Cancellation" },
  { href: "/acceptable-use", label: "Acceptable Use" },
  { href: "/cookies", label: "Cookie Policy" },
  { href: "/subprocessors", label: "Sub-processors" },
  { href: "/dpa", label: "Data Processing Addendum" },
];

/**
 * Shared shell for the legal / compliance pages: consistent heading, an
 * "effective date", cross-links to the other policies, and a readable prose
 * column. Keeps every policy page visually identical and easy to scan.
 */
export function LegalPage({
  title,
  intro,
  path,
  lastUpdated = legalConfig.effectiveDate,
  children,
}: {
  title: string;
  intro?: string;
  path: string;
  lastUpdated?: string;
  children: ReactNode;
}) {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Legal", path: "/legal" },
          { name: title, path },
        ]}
      />
      <Section>
        <Container>
          <div className="mx-auto max-w-3xl">
            <Link
              href="/legal"
              className="focus-ring rounded text-sm font-medium text-accent-600 hover:underline dark:text-accent-400"
            >
              ← All policies
            </Link>

            <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{title}</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Effective {lastUpdated} · Operated by {legalConfig.operatorName}, {legalConfig.operatorDescriptor}
            </p>
            {intro && <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">{intro}</p>}

            <nav
              aria-label="Legal documents"
              className="mt-6 flex flex-wrap gap-2 border-y border-slate-200 py-4 dark:border-slate-800"
            >
              {legalPages.map((p) => (
                <Link
                  key={p.href}
                  href={p.href}
                  className={
                    "focus-ring rounded-full px-3 py-1 text-xs font-medium transition-colors " +
                    (p.href === path
                      ? "bg-accent-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700")
                  }
                  aria-current={p.href === path ? "page" : undefined}
                >
                  {p.label}
                </Link>
              ))}
            </nav>

            <div className="mt-8">
              <Prose>{children}</Prose>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
