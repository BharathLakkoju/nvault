import type { Metadata } from "next";
import { Container, Section, SectionHeading, Prose, CtaLink } from "@/components/marketing/ui";
import { AuroraBackground } from "@/components/marketing/aurora-background";
import { BreadcrumbJsonLd } from "@/components/marketing/json-ld";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "About",
  description:
    "Why nvault exists: environment configuration is sensitive, changes often, and needs to follow developers across machines — without a vendor ever seeing plaintext.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <>
      <BreadcrumbJsonLd items={[{ name: "Home", path: "/" }, { name: "About", path: "/about" }]} />
      <Section className="relative isolate">
        <AuroraBackground />
        <Container>
          <SectionHeading eyebrow="About" title="Your development environment, available anywhere" align="left" />
          <div className="mt-10 max-w-3xl">
            <Prose>
              <p>
                Every developer has copied a <code>.env</code> file between machines over Slack, email or a USB stick.
                It works until it doesn&apos;t: a key goes missing, a value is stale, or the file lands in a Git history
                it should never have touched.
              </p>
              <p>
                nvault treats environment configuration as what it is — sensitive data that changes often and needs
                to move with you. It is a secure, developer-native vault: store your config files once, keep a full
                version history, and restore any project&apos;s environment on a new machine in one command.
              </p>

              <h2>Principles</h2>
              <ul>
                <li>
                  <strong>Security first.</strong> Encryption happens in your browser. The server stores ciphertext and
                  wrapped keys, never plaintext and never your passphrase.
                </li>
                <li>
                  <strong>Fidelity.</strong> Files are preserved byte-for-byte. nvault does not parse and rewrite your
                  configuration.
                </li>
                <li>
                  <strong>The CLI is a product, not an afterthought.</strong> WSL, SSH and headless workflows are
                  first-class.
                </li>
                <li>
                  <strong>Boring where it counts.</strong> Standard algorithms, explicit destructive actions, and no
                  third-party scripts on the page.
                </li>
              </ul>

              <h2>Status</h2>
              <p>
                nvault is in early access. The web application — authentication, projects, upload and download,
                versioning and restore — is available today. The terminal CLI and process secret injection
                (<code>nvault run</code>) are next on the roadmap.
              </p>
            </Prose>

            <div className="mt-12">
              <CtaLink href="/register">Create your vault</CtaLink>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
