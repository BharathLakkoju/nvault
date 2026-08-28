import { spawn } from "node:child_process";
import { isDotenvStyleFile } from "@core/filename";
import { apiRequest } from "../lib/api-client";
import { resolveProject } from "../lib/resolve-project";
import { unlockVaultForThisCommand } from "../lib/vault-session";
import { openProjectKey, decryptFile, bytesToUtf8 } from "../lib/vault-client";
import { parseDotenv } from "../lib/dotenv-parse";
import { resolveExecutable } from "../lib/which";
import type { DownloadedFileDto, FileDto } from "../lib/types";

/**
 * Decrypts the project's environment files and injects them directly into
 * the child process's environment — nothing is ever written to disk. This
 * is the headline zero-disk-footprint workflow: secrets exist only for the
 * lifetime of the spawned process.
 */
export async function runCommand(projectName: string | undefined, commandParts: string[]): Promise<never> {
  if (commandParts.length === 0) {
    throw new Error("Usage: envvault run [project] -- <command> [args...]");
  }

  const project = await resolveProject(projectName);
  const { masterKey } = await unlockVaultForThisCommand();
  const projectKey = await openProjectKey(masterKey, project.id, project.wrappedProjectKey);

  const { files } = await apiRequest<{ files: FileDto[] }>(`/projects/${project.id}/files`);
  const envFiles = files.filter((f) => f.currentVersion && isDotenvStyleFile(f.filename));

  const injected: Record<string, string> = {};
  for (const file of envFiles) {
    const downloaded = await apiRequest<DownloadedFileDto>(
      `/projects/${project.id}/files/${file.id}/versions/${file.currentVersion!.id}`,
    );
    const plaintext = await decryptFile(projectKey, downloaded.payload);
    Object.assign(injected, parseDotenv(bytesToUtf8(plaintext)));
  }

  if (envFiles.length > 0) {
    console.error(`Injecting: ${envFiles.map((f) => f.filename).join(", ")}`);
  } else {
    console.error("No dotenv-style files found in this project — running with no injected variables.");
  }

  const [command, ...args] = commandParts;
  const child = spawn(resolveExecutable(command), args, {
    stdio: "inherit",
    env: { ...process.env, ...injected },
  });

  return new Promise<never>((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      process.exit(code ?? (signal ? 1 : 0));
    });
  });
}
