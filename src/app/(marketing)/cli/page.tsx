import type { Metadata } from "next";
import Link from "next/link";
import { Container, Section, SectionHeading, Prose, CommandBlock, CtaLink } from "@/components/marketing/ui";
import { AuroraBackground } from "@/components/marketing/aurora-background";
import { AnimatedTerminal } from "@/components/marketing/animated-terminal";
import { BreadcrumbJsonLd } from "@/components/marketing/json-ld";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "CLI",
  description:
    "Install the EnvVault CLI and learn every command: device-code login, Git-aware project detection, push and pull, version history, CI usage, and envvault run.",
  path: "/cli",
});

const commands: ReadonlyArray<{ cmd: string; desc: string }> = [
  { cmd: "envvault login", desc: "Authenticate this device via a browser device-code flow — no password typed into the terminal." },
  { cmd: "envvault logout", desc: "Remove this device's stored credentials and revoke its session." },
  { cmd: "envvault whoami", desc: "Print the account this device is authenticated as." },
  { cmd: "envvault projects", desc: "List the projects you have access to." },
  { cmd: "envvault init", desc: "Detect the project from the Git remote and offer to restore its environment files." },
  { cmd: "envvault push [project]", desc: "Encrypt and upload the config files in the current directory." },
  { cmd: "envvault pull [project]", desc: "Download and decrypt files, with confirmation before overwriting anything local." },
  { cmd: "envvault files <project>", desc: "List the files stored for a project and their current versions." },
  { cmd: "envvault history <file>", desc: "Show the version history for a file." },
  { cmd: "envvault restore <file> --version <v>", desc: "Restore a previous version as the current one." },
  { cmd: "envvault delete <project> <file>", desc: "Delete a file from a project (the version history is retained)." },
  { cmd: "envvault run -- <command>", desc: "Inject decrypted secrets into a child process without writing a .env file to disk." },
];

export default function CliPage() {
  return (
    <>
      <BreadcrumbJsonLd items={[{ name: "Home", path: "/" }, { name: "CLI", path: "/cli" }]} />

      {/* Hero */}
      <Section className="relative isolate">
        <AuroraBackground />
        <Container>
          <SectionHeading
            eyebrow="CLI"
            title="Your environment, one command away"
            description="The EnvVault CLI is designed for WSL, SSH sessions, remote servers, cloud VMs and CI — anywhere a browser is inconvenient or unavailable."
          />
          <div className="mx-auto mt-6 max-w-2xl rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
            The CLI is in <strong>preview</strong>. Commands and installation below reflect the planned interface; the{" "}
            <Link href="/features" className="font-medium underline">
              web app
            </Link>{" "}
            is available today.
          </div>

          <div className="mx-auto mt-12 max-w-2xl">
            <AnimatedTerminal
              title="new machine — bash"
              steps={[
                {
                  command: "envvault login",
                  output: [
                    "",
                    "Open:  https://app.envvault.dev/device",
                    "Code:  X7KD-29PL",
                    "",
                    "Waiting for authentication...",
                    "✓ Device authenticated",
                  ],
                },
                { command: "envvault whoami", output: ["dev@acme.com  ·  2 projects"] },
              ]}
            />
          </div>
        </Container>
      </Section>

      {/* Installation */}
      <Section className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40">
        <Container>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Installation</h2>
          <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">
            The CLI is a single self-contained binary. Pick whichever channel fits your platform and toolchain.
          </p>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">npm / pnpm / yarn</h3>
              <div className="mt-2">
                <CommandBlock>
                  {"npm install -g envvault-cli\n# or: pnpm add -g envvault-cli\n# or: yarn global add envvault-cli"}
                </CommandBlock>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Homebrew (macOS / Linux)</h3>
              <div className="mt-2">
                <CommandBlock>{"brew install envvault/tap/envvault"}</CommandBlock>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Shell script (macOS / Linux / WSL)</h3>
              <div className="mt-2">
                <CommandBlock>{"curl -fsSL https://get.envvault.dev | sh"}</CommandBlock>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Inspect the script first if you prefer: <code>curl -fsSL https://get.envvault.dev</code>.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Windows (Scoop)</h3>
              <div className="mt-2">
                <CommandBlock>{"scoop bucket add envvault https://github.com/envvault/scoop\nscoop install envvault"}</CommandBlock>
              </div>
            </div>
          </div>

          <h3 className="mt-10 text-sm font-semibold text-slate-900 dark:text-slate-100">Verify the install</h3>
          <div className="mt-2 max-w-md">
            <CommandBlock>{"envvault --version\nenvvault --help"}</CommandBlock>
          </div>
        </Container>
      </Section>

      {/* Everyday workflows */}
      <Section>
        <Container>
          <SectionHeading
            eyebrow="Walkthrough"
            title="How you actually use it"
            description="Three workflows that cover almost everything: restore on a new machine, push a change, and run a command with secrets injected."
          />

          <div className="mx-auto mt-14 max-w-3xl space-y-16">
            <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.2fr]">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">1. Restore a project</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  Clone the repo, <code>cd</code> in, and let <code>init</code> match the project from your Git remote.
                  Nothing on disk is overwritten without a prompt.
                </p>
              </div>
              <AnimatedTerminal
                title="portfolio-analytics — bash"
                steps={[
                  { command: "git clone git@github.com:acme/portfolio-analytics.git", output: ["Cloning into 'portfolio-analytics'..."] },
                  { command: "cd portfolio-analytics" },
                  {
                    command: "envvault init",
                    output: [
                      "Git repository:   github.com/acme/portfolio-analytics",
                      "Matching project: portfolio-analytics",
                      "",
                      "Restore 3 files?  .env  .env.local  .env.production",
                    ],
                  },
                  {
                    command: "envvault pull",
                    output: ["✓ Vault unlocked", "✓ 3 files decrypted locally", "✓ Environment restored"],
                  },
                ]}
              />
            </div>

            <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.2fr]">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">2. Push a change</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  Edit a file, push it, and it becomes a new version. Sensitive filenames get a warning before upload.
                </p>
              </div>
              <AnimatedTerminal
                title="portfolio-analytics — bash"
                steps={[
                  { command: "echo 'FEATURE_BILLING=1' >> .env.local" },
                  {
                    command: "envvault push",
                    output: [
                      "2 files changed:  .env.local (v4)  .env (unchanged)",
                      "✓ Encrypted locally  ·  ✓ Uploaded",
                    ],
                  },
                  {
                    command: "envvault history .env.local",
                    output: ["v4  2026-08-27  1.2 KB  (current)", "v3  2026-08-19  1.1 KB", "v2  2026-08-04  1.1 KB"],
                  },
                ]}
              />
            </div>

            <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.2fr]">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">3. Run without a .env</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  <code>envvault run</code> decrypts in memory and injects the values into the child process. No file is
                  written to disk. See{" "}
                  <Link href="/blog/roadmap-envvault-run" className="font-medium text-accent-600 hover:underline dark:text-accent-400">
                    the roadmap post
                  </Link>
                  .
                </p>
              </div>
              <AnimatedTerminal
                title="portfolio-analytics — bash"
                steps={[
                  {
                    command: "envvault run -- npm run dev",
                    output: [
                      "✓ Vault unlocked  ·  injected 12 variables",
                      "",
                      "> next dev",
                      "  ▲ Next.js — ready on http://localhost:3000",
                    ],
                  },
                ]}
              />
            </div>
          </div>
        </Container>
      </Section>

      {/* Command reference */}
      <Section className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40">
        <Container>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Command reference</h2>
          <div className="mt-8 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {commands.map((row) => (
                  <tr key={row.cmd} className="bg-white dark:bg-slate-900">
                    <td className="whitespace-nowrap px-4 py-3 align-top font-mono text-[13px] text-accent-600 dark:text-accent-400">
                      {row.cmd}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </Section>

      {/* Config, CI, principles */}
      <Section>
        <Container>
          <div className="mx-auto max-w-3xl">
            <Prose>
              <h2>Credentials &amp; configuration</h2>
              <p>
                After <code>envvault login</code>, the CLI stores a short-lived access token and a refresh token in
                OS-appropriate secure storage — Keychain on macOS, Credential Manager on Windows, the Secret Service API
                on Linux where available. It never writes tokens to a plaintext dotfile, and never prints them unless you
                ask. Your <Link href="/blog/zero-knowledge-encryption-explained">vault passphrase</Link> is a separate
                secret that unlocks encryption per session and is never stored.
              </p>

              <h3>Non-interactive use</h3>
              <p>
                Every command accepts <code>--json</code> for machine-readable output and returns a meaningful exit code.
                Pass <code>--yes</code> to skip confirmation prompts in automation, and <code>--no-input</code> to fail
                rather than prompt.
              </p>

              <h2>Using it in CI</h2>
              <p>
                For CI, create a scoped, revocable machine token in the web app and expose it as{" "}
                <code>ENVVAULT_TOKEN</code>. Provide the vault passphrase as a masked secret. The runner fetches config
                for exactly one step and nothing is persisted into the workspace.
              </p>
              <pre>
                <code>{`# GitHub Actions
- run: envvault run --project portfolio-analytics -- pnpm test
  env:
    ENVVAULT_TOKEN: \${{ secrets.ENVVAULT_TOKEN }}
    ENVVAULT_PASSPHRASE: \${{ secrets.ENVVAULT_PASSPHRASE }}`}</code>
              </pre>

              <h2>Design principles</h2>
              <ul>
                <li>Credentials are stored in OS-appropriate secure storage, never in plaintext config.</li>
                <li>Authentication uses a browser/device flow — your account password is never typed into the CLI.</li>
                <li>Tokens are not printed unnecessarily, keeping secrets out of shell history and scrollback.</li>
                <li>Commands return meaningful exit codes and run non-interactively when asked.</li>
                <li>Project detection is deterministic and explained: it tells you which remote matched which project.</li>
                <li>Local files are never overwritten without an explicit prompt and a backup.</li>
              </ul>

              <h2>Availability</h2>
              <p>
                The web application is available today. The CLI is in preview; the API is already versioned and shaped so
                it can be added without server-side changes. Web and CLI are backed by the same domain model, so
                behaviour stays identical across both. Read more in{" "}
                <Link href="/blog/the-cli-is-a-product">The CLI is a product, not an afterthought</Link>.
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
