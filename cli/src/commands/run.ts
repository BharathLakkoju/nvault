import { spawn } from "node:child_process";
import { isDotenvStyleFile } from "@core/filename";
import { apiRequest } from "../lib/api-client";
import { resolveProject } from "../lib/resolve-project";
import { unlockVaultForThisCommand } from "../lib/vault-session";
import { resolveProjectKey } from "../lib/project-key";
import { decryptFile, bytesToUtf8 } from "../lib/vault-client";
import { parseDotenv } from "../lib/dotenv-parse";
import { resolveExecutable } from "../lib/which";
import type { DownloadedFileDto, FileDto } from "../lib/types";

export const ERR_NO_DOTENV_FILES =
  "No dotenv-style secrets in this project. Add them with `nvault push`, or rerun with `--allow-empty`.";

export const ERR_EMPTY_DOTENV_VARS =
  "Dotenv file(s) are present but contain no variables. Add secrets with `nvault push`, or rerun with `--allow-empty`.";

export const WARN_ALLOW_EMPTY_RUN =
  "No secrets to inject — running the child with your current environment only.";

export interface RunOptions {
  allowEmpty?: boolean;
}

/**
 * Decrypts the project's environment files and injects them directly into
 * the child process's environment — nothing is ever written to disk. This
 * is the headline zero-disk-footprint workflow: secrets exist only for the
 * lifetime of the spawned process.
 */
export async function runCommand(
  projectName: string | undefined,
  commandParts: string[],
  options: RunOptions = {},
): Promise<never> {
  if (commandParts.length === 0) {
    throw new Error("Usage: nvault run [project] -- <command> [args...]");
  }

  const project = await resolveProject(projectName);
  const session = await unlockVaultForThisCommand();
  const projectKey = await resolveProjectKey(project, session);

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

  const hasSecrets = envFiles.length > 0 && Object.keys(injected).length > 0;

  if (!hasSecrets) {
    if (envFiles.length === 0) {
      if (!options.allowEmpty) {
        throw new Error(ERR_NO_DOTENV_FILES);
      }
    } else if (Object.keys(injected).length === 0) {
      if (!options.allowEmpty) {
        throw new Error(ERR_EMPTY_DOTENV_VARS);
      }
    }
    console.error(WARN_ALLOW_EMPTY_RUN);
  } else {
    console.error(`Injecting: ${envFiles.map((f) => f.filename).join(", ")}`);
  }

  const [command, ...args] = commandParts;
  const child = spawn(resolveExecutable(command), args, {
    stdio: "inherit",
    env: hasSecrets ? { ...process.env, ...injected } : { ...process.env },
  });

  return new Promise<never>((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      process.exit(code ?? (signal ? 1 : 0));
    });
  });
}
