import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { apiRequest } from "../lib/api-client";
import { resolveProject } from "../lib/resolve-project";
import { unlockVaultForThisCommand } from "../lib/vault-session";
import { resolveProjectKey } from "../lib/project-key";
import { decryptFile } from "../lib/vault-client";
import { promptConfirm } from "../lib/prompt";
import { symbols } from "../lib/colors";
import type { DownloadedFileDto, FileDto } from "../lib/types";

export interface PullOptions {
  yes?: boolean;
}

async function writeWithBackup(cwd: string, filename: string, content: Uint8Array, yes?: boolean): Promise<boolean> {
  const path = join(cwd, filename);
  if (existsSync(path)) {
    const existing = readFileSync(path);
    if (Buffer.compare(existing, Buffer.from(content)) === 0) {
      return false; // already up to date, nothing to do
    }
    if (!yes) {
      const overwrite = await promptConfirm(`${filename} already exists locally. Overwrite?`);
      if (!overwrite) return false;
    }
    const backupPath = `${path}.bak.${Date.now()}`;
    renameSync(path, backupPath);
    console.log(`  (backed up existing ${filename} to ${backupPath.split("/").pop()})`);
  }
  writeFileSync(path, content);
  return true;
}

export async function pullCommand(
  projectName: string | undefined,
  filename: string | undefined,
  options: PullOptions,
): Promise<void> {
  const cwd = process.cwd();
  const project = await resolveProject(projectName);
  const session = await unlockVaultForThisCommand();
  const projectKey = await resolveProjectKey(project, session);

  console.log(`\n${project.name}\n`);

  const { files } = await apiRequest<{ files: FileDto[] }>(`/projects/${project.id}/files`);
  const targets = filename ? [filename] : files.filter((f) => f.currentVersion).map((f) => f.filename);

  if (targets.length === 0) {
    console.log("No files to restore.");
    return;
  }

  let written = 0;
  for (const name of targets) {
    const file = files.find((f) => f.filename === name);
    if (!file?.currentVersion) {
      console.log(`  ${symbols.warn} ${name} not found in this project`);
      continue;
    }
    const downloaded = await apiRequest<DownloadedFileDto>(
      `/projects/${project.id}/files/${file.id}/versions/${file.currentVersion.id}`,
    );
    const plaintext = await decryptFile(projectKey, downloaded.payload);
    const wrote = await writeWithBackup(cwd, name, plaintext, options.yes);
    if (wrote) {
      console.log(`${symbols.check} ${name}`);
      written++;
    } else {
      console.log(`  (skipped ${name})`);
    }
  }

  console.log(`\n${written} file(s) restored`);
}
