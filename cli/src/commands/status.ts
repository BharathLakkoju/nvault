import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { apiRequest } from "../lib/api-client";
import { detectGitRemote } from "../lib/git";
import { sha256Hex } from "../lib/vault-client";
import { symbols } from "../lib/colors";
import type { FileDto, ProjectDto } from "../lib/types";

export async function statusCommand(): Promise<void> {
  const cwd = process.cwd();
  const remote = detectGitRemote(cwd);

  if (!remote) {
    console.log("Not in a git repository with a detectable remote. Use `nvault files <project>` instead.");
    return;
  }

  const { project } = await apiRequest<{ project: ProjectDto | null }>(
    `/projects/by-git-remote?url=${encodeURIComponent(remote)}`,
  );
  if (!project) {
    console.log(`No nvault project matches this repository (${remote}).`);
    return;
  }

  console.log(`Project: ${project.name}\n`);
  const { files } = await apiRequest<{ files: FileDto[] }>(`/projects/${project.id}/files`);

  if (files.length === 0) {
    console.log("No files stored in this project yet.");
    return;
  }

  for (const file of files) {
    const localPath = join(cwd, file.filename);
    if (!existsSync(localPath)) {
      console.log(`  ${symbols.warn} ${file.filename}  (not present locally — run \`nvault pull\`)`);
      continue;
    }
    if (!file.currentVersion) continue;
    const localHash = await sha256Hex(new Uint8Array(readFileSync(localPath)));
    if (localHash === file.currentVersion.plaintextSha256) {
      console.log(`  ${symbols.check} ${file.filename}  up to date`);
    } else {
      console.log(`  ${symbols.warn} ${file.filename}  differs from the latest stored version`);
    }
  }
}
