import type { Metadata } from "next";
import { Container, Section, SectionHeading, Prose, CtaLink } from "@/components/marketing/ui";
import { BreadcrumbJsonLd } from "@/components/marketing/json-ld";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Security",
  description:
    "EnvVault's zero-knowledge security model: client-side AES-256-GCM encryption, a PBKDF2 key hierarchy, server-side envelope encryption, and strict authorization.",
  path: "/security",
});

const keyHierarchy: ReadonlyArray<{ layer: string; detail: string }> = [
  {
    layer: "Vault passphrase",
    detail: "User-chosen, never transmitted. Feeds PBKDF2-HMAC-SHA256 at 600,000 iterations with a random 128-bit salt.",
  },
  {
    layer: "Key Encryption Key (KEK)",
    detail: "Derived fresh on every unlock, held only in memory, never stored.",
  },
  {
    layer: "Master key",
    detail: "Random 256 bits, generated once at signup. Persisted server-side only in wrapped form.",
  },
  {
    layer: "Project data key",
    detail: "One random 256-bit key per project, wrapped by the master key with the project id bound as AAD.",
  },
  {
    layer: "File version ciphertext",
    detail: "Each file version is AES-256-GCM encrypted under its project key and leaves the browser as ciphertext.",
  },
];

export default function SecurityPage() {
  return (
    <>
      <BreadcrumbJsonLd items={[{ name: "Home", path: "/" }, { name: "Security", path: "/security" }]} />
      <Section>
        <Container>
          <SectionHeading
            eyebrow="Security"
            title="Zero-knowledge by construction"
            description="The server — API route handlers and database — never has access to plaintext file contents, nor to the key material needed to decrypt them."
          />
        </Container>
      </Section>

      <Section className="border-t border-slate-200 bg-slate-50 py-16 dark:border-slate-800 dark:bg-slate-900/40">
        <Container>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Key hierarchy</h2>
          <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">
            Each step wraps the next and binds an identifier as AEAD additional authenticated data, so a ciphertext or
            wrapped key cannot be silently moved onto another record.
          </p>
          <ol className="mt-10 space-y-4">
            {keyHierarchy.map((row, i) => (
              <li
                key={row.layer}
                className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-baseline gap-3">
                  <span className="text-sm font-mono text-accent-600 dark:text-accent-400">{i + 1}</span>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{row.layer}</h3>
                </div>
                <p className="mt-1.5 pl-7 text-sm text-slate-600 dark:text-slate-300">{row.detail}</p>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      <Section>
        <Container>
          <div className="mx-auto max-w-3xl">
            <Prose>
              <h2>Defense in depth: server-side storage encryption</h2>
              <p>
                The ciphertext your browser uploads is encrypted <strong>again</strong> before it is written to
                Postgres, under a 32-byte key that lives only in the deployment&apos;s environment and never in the
                database. A stolen database dump on its own is inert — it contains no plaintext and no usable keys.
              </p>

              <h2>Authentication &amp; sessions</h2>
              <ul>
                <li>Account passwords are hashed with Argon2id; they are never used directly as encryption keys.</li>
                <li>Access tokens are short-lived; refresh tokens are stored in an httpOnly, same-site cookie.</li>
                <li>Every device/session is listed and independently revocable.</li>
              </ul>

              <h2>Authorization</h2>
              <ul>
                <li>Every project, file and version operation is authorization-checked on the server.</li>
                <li>Identifiers are non-guessable UUIDs; you cannot reach another account&apos;s data by changing an id.</li>
                <li>Frontend checks are never the only line of defense.</li>
              </ul>

              <h2>What we deliberately do not do</h2>
              <ul>
                <li>We do not log plaintext environment variables, keys, tokens or passwords.</li>
                <li>We do not expose secret values in API responses or the web UI by default.</li>
                <li>We do not send secrets to third-party analytics or monitoring.</li>
                <li>We do not have a passphrase-recovery mechanism — there is nothing on our side to recover from.</li>
              </ul>

              <h2>Transport</h2>
              <p>
                All traffic is HTTPS/TLS with HSTS. A strict Content Security Policy blocks external origins; the app
                loads no third-party scripts.
              </p>
            </Prose>

            <div className="mt-12 rounded-lg border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
              <strong>Your responsibility:</strong> because only you hold the vault passphrase, losing it means losing
              access to the encrypted data. Keep it in a password manager and back up critical files offline.
            </div>

            <div className="mt-10">
              <CtaLink href="/register">Create a vault</CtaLink>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
