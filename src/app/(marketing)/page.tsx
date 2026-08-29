import type { Metadata } from "next";
import Link from "next/link";
import { Container, Section, SectionHeading, Eyebrow, CtaLink } from "@/components/marketing/ui";
import { RedirectIfAuthenticated } from "@/components/marketing/redirect-if-authenticated";
import { AuroraBackground } from "@/components/marketing/aurora-background";
import { SoftwareApplicationJsonLd } from "@/components/marketing/json-ld";
import { features, howItWorks, faqs } from "@/lib/marketing-content";
import { pageMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: siteConfig.tagline,
  description: siteConfig.metaDescription,
  path: "/",
});

function Terminal() {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950 shadow-xl dark:border-slate-800">
      <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-red-400/80" />
        <span className="h-3 w-3 rounded-full bg-amber-400/80" />
        <span className="h-3 w-3 rounded-full bg-green-400/80" />
        <span className="ml-3 text-xs text-slate-400">portfolio-analytics — bash</span>
      </div>
      <pre className="overflow-x-auto px-4 py-4 text-[13px] leading-relaxed text-slate-300">
        <code>
          <span className="text-slate-500">$</span> nvault init{"\n"}
          {"\n"}
          Git repository:   github.com/bharath/portfolio-analytics{"\n"}
          Matching project: <span className="text-emerald-400">portfolio-analytics</span>{"\n"}
          {"\n"}
          Restore 3 files into this directory?{"\n"}
          {"  .env  .env.local  .env.production"}{"\n"}
          {"\n"}
          <span className="text-slate-500">$</span> nvault pull{"\n"}
          <span className="text-emerald-400">✓</span> Vault unlocked{"\n"}
          <span className="text-emerald-400">✓</span> 3 files decrypted locally{"\n"}
          <span className="text-emerald-400">✓</span> Environment restored{"\n"}
        </code>
      </pre>
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      <RedirectIfAuthenticated />
      <SoftwareApplicationJsonLd />

      {/* Hero */}
      <Section className="relative isolate pt-16 sm:pt-24">
        <AuroraBackground />
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <Eyebrow>Zero-knowledge environment vault</Eyebrow>
              <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-5xl">
                Your development environment, available anywhere.
              </h1>
              <p className="mt-5 text-lg text-slate-600 dark:text-slate-300">
                nvault stores your <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[0.9em] dark:bg-slate-800">.env</code>{" "}
                and project configuration files encrypted end-to-end. Encrypt in the browser, keep a full version
                history, and restore any project&apos;s environment on a new machine in one command.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <CtaLink href="/register">Get started free</CtaLink>
                <CtaLink href="/security" variant="secondary">
                  How the encryption works
                </CtaLink>
              </div>
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                No credit card. The server never sees your plaintext or your passphrase.
              </p>
            </div>
            <Terminal />
          </div>
        </Container>
      </Section>

      {/* How it works */}
      <Section className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40">
        <Container>
          <SectionHeading
            eyebrow="How it works"
            title="Three steps to an environment that follows you"
            description="Set up once. Every machine after that is a clone-and-pull."
          />
          <ol className="mt-14 grid gap-8 md:grid-cols-3">
            {howItWorks.map((step, i) => (
              <li key={step.title} className="relative">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent-600 text-sm font-semibold text-white">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-100">{step.title}</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{step.description}</p>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      {/* Features */}
      <Section>
        <Container>
          <SectionHeading
            eyebrow="Features"
            title="A developer-native secure vault — not cloud storage for secrets"
            description="Everything is built around the way environment configuration actually changes: often, and in ways that can break your setup."
          />
          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
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
          <div className="mt-12 text-center">
            <Link href="/features" className="focus-ring rounded text-sm font-semibold text-accent-600 hover:underline dark:text-accent-400">
              See all features →
            </Link>
          </div>
        </Container>
      </Section>

      {/* Security band */}
      <Section className="border-t border-slate-200 bg-slate-950 text-slate-100 dark:border-slate-800">
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <Eyebrow>Security model</Eyebrow>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Designed so a breach of our servers reveals nothing
              </h2>
              <p className="mt-4 text-lg text-slate-300">
                A key derived from your vault passphrase (PBKDF2, 600,000 iterations) wraps a per-account master key,
                which wraps a per-project key, which encrypts each file. Every layer is AES-256-GCM with bound
                additional authenticated data.
              </p>
              <div className="mt-8">
                <CtaLink href="/security" variant="secondary">
                  Read the full threat model
                </CtaLink>
              </div>
            </div>
            <ul className="space-y-4 text-sm">
              {[
                "Plaintext and passphrases never leave your browser",
                "Server-side envelope encryption over every stored blob",
                "Non-guessable UUIDs and per-request authorization checks",
                "Short-lived access tokens with device/session revocation",
                "Audit logging that never records secret contents",
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-emerald-400" aria-hidden>
                    <path d="m20 6-11 11-5-5" />
                  </svg>
                  <span className="text-slate-300">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </Section>

      {/* CLI teaser */}
      <Section>
        <Container>
          <SectionHeading
            eyebrow="CLI"
            title="First-class terminal workflow"
            description="Built for WSL, SSH sessions, remote servers and headless CI — where a browser is inconvenient or unavailable."
          />
          <div className="mx-auto mt-12 max-w-2xl">
            <Terminal />
          </div>
          <div className="mt-8 text-center">
            <Link href="/cli" className="focus-ring rounded text-sm font-semibold text-accent-600 hover:underline dark:text-accent-400">
              Explore the CLI →
            </Link>
          </div>
        </Container>
      </Section>

      {/* FAQ teaser */}
      <Section className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40">
        <Container>
          <SectionHeading eyebrow="FAQ" title="Common questions" />
          <dl className="mx-auto mt-12 max-w-3xl space-y-6">
            {faqs.slice(0, 4).map((faq) => (
              <div key={faq.question}>
                <dt className="text-base font-semibold text-slate-900 dark:text-slate-100">{faq.question}</dt>
                <dd className="mt-2 text-sm text-slate-600 dark:text-slate-300">{faq.answer}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-10 text-center">
            <Link href="/faq" className="focus-ring rounded text-sm font-semibold text-accent-600 hover:underline dark:text-accent-400">
              All questions →
            </Link>
          </div>
        </Container>
      </Section>

      {/* Final CTA */}
      <Section>
        <Container>
          <div className="relative isolate overflow-hidden rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center dark:border-slate-800 dark:bg-slate-900">
            <AuroraBackground grid={false} />
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Stop copying <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[0.85em] dark:bg-slate-800">.env</code> files between machines
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-600 dark:text-slate-300">
              Create a vault, push your first project, and restore it anywhere in minutes.
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <CtaLink href="/register">Create your vault</CtaLink>
              <CtaLink href="/login" variant="secondary">
                Log in
              </CtaLink>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
