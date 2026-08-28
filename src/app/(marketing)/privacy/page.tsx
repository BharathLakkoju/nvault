import type { Metadata } from "next";
import { Container, Section, Prose } from "@/components/marketing/ui";
import { BreadcrumbJsonLd } from "@/components/marketing/json-ld";
import { pageMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy",
  description:
    "How EnvVault handles your data. Because the vault is zero-knowledge, we cannot access your file contents or your vault passphrase.",
  path: "/privacy",
});

const LAST_UPDATED = "28 August 2026";

export default function PrivacyPage() {
  return (
    <>
      <BreadcrumbJsonLd items={[{ name: "Home", path: "/" }, { name: "Privacy", path: "/privacy" }]} />
      <Section>
        <Container>
          <div className="mx-auto max-w-3xl">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Privacy Policy</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Last updated {LAST_UPDATED}</p>

            <div className="mt-8">
              <Prose>
                <p>
                  This policy explains what data EnvVault (&quot;we&quot;) collects and how it is used. It is written to
                  match how the product actually works: a zero-knowledge vault in which encryption happens in your
                  browser.
                </p>

                <h2>What we cannot see</h2>
                <ul>
                  <li>The plaintext contents of any file you store.</li>
                  <li>Your vault passphrase, which is never transmitted to us.</li>
                  <li>The key material required to decrypt your files.</li>
                </ul>
                <p>
                  Files reach our servers already encrypted and are stored only as ciphertext. See the{" "}
                  <a href="/security">security page</a> for the full model.
                </p>

                <h2>What we do collect</h2>
                <ul>
                  <li>
                    <strong>Account data:</strong> your email address, an optional display name, and a hashed account
                    password.
                  </li>
                  <li>
                    <strong>Vault metadata:</strong> project names, file names, version timestamps and sizes, and the
                    wrapped (encrypted) keys needed for your own client to decrypt.
                  </li>
                  <li>
                    <strong>Session data:</strong> active devices/sessions and their last-seen time, so you can review
                    and revoke them.
                  </li>
                  <li>
                    <strong>Audit records:</strong> timestamps and types of security-sensitive actions. These never
                    contain secret values.
                  </li>
                  <li>
                    <strong>Operational logs:</strong> minimal request metadata for reliability and abuse prevention.
                    We do not log environment variables, keys, tokens or passwords.
                  </li>
                </ul>

                <h2>How we use it</h2>
                <ul>
                  <li>To operate the service — authentication, storage, versioning and restore.</li>
                  <li>To secure accounts and detect abuse.</li>
                  <li>To respond to support requests you send us.</li>
                </ul>
                <p>We do not sell your data. We do not send secrets to third-party analytics or monitoring services.</p>

                <h2>Third parties</h2>
                <p>
                  We use infrastructure providers for hosting and database storage. They process encrypted blobs and
                  account metadata on our behalf under their own security controls; they do not receive plaintext file
                  contents or your passphrase.
                </p>

                <h2>Data retention</h2>
                <p>
                  Vault data is retained while your account is active. Deleting a file, version or project removes it
                  from active storage. Closing your account removes your vault data; short-lived backups and audit
                  records may persist for a limited period for security and legal reasons.
                </p>

                <h2>Your rights</h2>
                <p>
                  You can access, export and delete your data from within the app, or by contacting us. Because the
                  vault is zero-knowledge, we cannot recover or produce plaintext we never had.
                </p>

                <h2>Contact</h2>
                <p>
                  Questions about this policy: <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>.
                </p>

                <h2>Changes</h2>
                <p>
                  We may update this policy as the product evolves. Material changes will be announced in the app or by
                  email, and the &quot;last updated&quot; date above will change.
                </p>
              </Prose>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
