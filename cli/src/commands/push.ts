import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { apiRequest } from "../lib/api-client";
import { resolveProject } from "../lib/resolve-project";
import { unlockVaultForThisCommand } from "../lib/vault-session";
import { resolveProjectKey } from "../lib/project-key";
import { encryptFile } from "../lib/vault-client";
import { promptConfirm } from "../lib/prompt";
import { color, symbols } from "../lib/colors";

const CANDIDATE_FILENAMES = [
  ".env",
  ".env.local",
  ".env.development",
  ".env.development.local",
  ".env.production",
  ".env.production.local",
  ".env.staging",
  ".env.test",
];

export interface PushOptions {
  yes?: boolean;
}

export async function pushCommand(
  projectName: string | undefined,
  filename: string | undefined,
  options: PushOptions,
): Promise<void> {
  const cwd = process.cwd();
  const targets = filename
    ? [filename]
    : CANDIDATE_FILENAMES.filter((f) => existsSync(join(cwd, f)));

  if (targets.length === 0) {
    throw new Error(
      "No environment files found in the current directory. Pass a filename explicitly, e.g. `nvault push myproject .env`.",
    );
  }
  for (const f of targets) {
    if (!existsSync(join(cwd, f))) {
      throw new Error(`File not found: ${f}`);
    }
  }

  const project = await resolveProject(projectName);

  console.log(`\nCurrent project: ${color.bold(project.name)}\n`);
  console.log("Detected:\n");
  targets.forEach((f) => console.log(`  ${f}`));
  console.log(`\n${symbols.warn} These files contain sensitive credentials.\n`);

  if (!options.yes) {
    if (!process.stdin.isTTY) {
      throw new Error("Refusing to upload sensitive files in a non-interactive shell without --yes.");
    }
    const confirmed = await promptConfirm(`Upload ${targets.length} file(s) to "${project.name}"?`);
    if (!confirmed) {
      console.log("Aborted.");
      return;
    }
  }

  const session = await unlockVaultForThisCommand();
  const projectKey = await resolveProjectKey(project, session);

  console.log();
  for (const f of targets) {
    const plaintext = new Uint8Array(readFileSync(join(cwd, f)));
    const { contentId, payload, plaintextSize, plaintextFingerprint } = await encryptFile(projectKey, plaintext);
    await apiRequest(`/projects/${project.id}/files`, {
      method: "POST",
      body: { filename: f, payload, contentId, plaintextSize, plaintextFingerprint },
    });
    console.log(`${symbols.check} ${f}`);
  }
  console.log(`\n${targets.length} file(s) pushed`);
}
