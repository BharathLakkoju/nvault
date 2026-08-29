import type { Metadata } from "next";
import { Container, Section, Prose } from "@/components/marketing/ui";
import { BreadcrumbJsonLd } from "@/components/marketing/json-ld";
import { pageMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Terms of Service",
  description: "The terms under which you may use nvault during early access.",
  path: "/terms",
});

const LAST_UPDATED = "28 August 2026";

export default function TermsPage() {
  return (
    <>
      <BreadcrumbJsonLd items={[{ name: "Home", path: "/" }, { name: "Terms", path: "/terms" }]} />
      <Section>
        <Container>
          <div className="mx-auto max-w-3xl">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Terms of Service</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Last updated {LAST_UPDATED}</p>

            <div className="mt-8">
              <Prose>
                <p>
                  By creating an account or using nvault (the &quot;Service&quot;) you agree to these terms. If you do
                  not agree, do not use the Service.
                </p>

                <h2>Early access</h2>
                <p>
                  The Service is provided during an early-access period. Features may change, and the Service is
                  provided on an &quot;as is&quot; and &quot;as available&quot; basis without warranties of any kind, to
                  the fullest extent permitted by law.
                </p>

                <h2>Your account</h2>
                <ul>
                  <li>You are responsible for activity under your account and for keeping your credentials secure.</li>
                  <li>
                    You are solely responsible for your vault passphrase. Because the Service is zero-knowledge, we
                    cannot reset it or recover data encrypted under it.
                  </li>
                  <li>You must be legally able to enter into these terms in your jurisdiction.</li>
                </ul>

                <h2>Acceptable use</h2>
                <ul>
                  <li>Do not use the Service to store content you have no right to store.</li>
                  <li>Do not attempt to breach or probe the security of the Service or other accounts.</li>
                  <li>Do not use the Service to distribute malware or conduct abuse.</li>
                </ul>

                <h2>Your content</h2>
                <p>
                  You retain all rights to the files you store. You grant us only the limited rights needed to store,
                  transmit and return encrypted blobs and metadata so the Service can function.
                </p>

                <h2>Availability and data</h2>
                <p>
                  We aim for high availability but do not guarantee uninterrupted service. You are responsible for
                  keeping your own backups of critical configuration. We are not liable for loss of data resulting from
                  a lost passphrase.
                </p>

                <h2>Limitation of liability</h2>
                <p>
                  To the maximum extent permitted by law, nvault is not liable for indirect, incidental or
                  consequential damages, or for loss of data or profits, arising from use of the Service.
                </p>

                <h2>Termination</h2>
                <p>
                  You may stop using the Service and delete your account at any time. We may suspend or terminate
                  access for violation of these terms.
                </p>

                <h2>Contact</h2>
                <p>
                  Questions about these terms: <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>.
                </p>

                <h2>Changes</h2>
                <p>
                  We may update these terms as the Service evolves. Continued use after a change constitutes acceptance
                  of the updated terms.
                </p>
              </Prose>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
