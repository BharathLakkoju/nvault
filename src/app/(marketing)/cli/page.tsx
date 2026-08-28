import type { Metadata } from "next";
import { Container, Section, SectionHeading, Prose } from "@/components/marketing/ui";
import { BreadcrumbJsonLd } from "@/components/marketing/json-ld";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "CLI",
  description:
    "The EnvVault terminal CLI: device-code login, Git-aware project detection, push and pull, version history, and secret injection with 'envvault run'.",
  path: "/cli",
});

const commands: ReadonlyArray<{ cmd: string; desc: string }> = [
  { cmd: "envvault login", desc: "Authenticate this device via a browser device-code flow — no password typed into the terminal." },
  { cmd: "envvault init", desc: "Detect the project from the Git remote and offer to restore its environment files." },
  { cmd: "envvault push [project]", desc: "Encrypt and upload the config files in the current directory." },
  { cmd: "envvault pull [project]", desc: "Download and decrypt files, with confirmation before overwriting anything local." },
  { cmd: "envvault files <project>", desc: "List the files stored for a project and their current versions." },
  { cmd: "envvault history <file>", desc: "Show the version history for a file." },
  { cmd: "envvault restore <file> --version <v>", desc: "Restore a previous version as current." },
  { cmd: "envvault run -- npm run dev", desc: "Inject decrypted secrets into a child process without writing a .env file to disk." },
];

export default function CliPage() {
  return (
    <>
      <BreadcrumbJsonLd items={[{ name: "Home", path: "/" }, { name: "CLI", path: "/cli" }]} />
      <Section>
        <Container>
          <SectionHeading
            eyebrow="CLI"
            title="The terminal is a first-class surface"
            description="Not an API wrapper. The CLI is designed for WSL, SSH sessions, remote servers, cloud VMs and CI — anywhere a browser is inconvenient or unavailable."
          />

          <div className="mx-auto mt-14 max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-slate-950 shadow-xl dark:border-slate-800">
            <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-red-400/80" />
              <span className="h-3 w-3 rounded-full bg-amber-400/80" />
              <span className="h-3 w-3 rounded-full bg-green-400/80" />
            </div>
            <pre className="overflow-x-auto px-4 py-4 text-[13px] leading-relaxed text-slate-300">
              <code>
                <span className="text-slate-500">$</span> envvault login{"\n"}
                {"\n"}
                Open:  https://app.envvault.dev/device{"\n"}
                Code:  <span className="text-accent-400">X7KD-29PL</span>{"\n"}
                {"\n"}
                Waiting for authentication...{"\n"}
                <span className="text-emerald-400">✓</span> Device authenticated{"\n"}
              </code>
            </pre>
          </div>
        </Container>
      </Section>

      <Section className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40">
        <Container>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Command reference</h2>
          <div className="mt-8 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
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

      <Section>
        <Container>
          <div className="mx-auto max-w-3xl">
            <Prose>
              <h2>Design principles</h2>
              <ul>
                <li>Credentials are stored in OS-appropriate secure storage, never in plaintext config.</li>
                <li>Authentication uses a browser/device flow — your account password is never typed into the CLI.</li>
                <li>Tokens are not printed unnecessarily, keeping secrets out of shell history and scrollback.</li>
                <li>Commands return meaningful exit codes and run non-interactively in automation.</li>
                <li>Project detection is deterministic and explained: it tells you which remote matched which project.</li>
              </ul>

              <h2>Availability</h2>
              <p>
                The web application is available today. The CLI is on the roadmap; the API is already versioned and
                shaped so it can be added without server-side changes. Web and CLI are backed by the same domain model,
                so behaviour stays identical across both.
              </p>
            </Prose>
          </div>
        </Container>
      </Section>
    </>
  );
}
