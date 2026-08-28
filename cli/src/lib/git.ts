import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Detects the git remote for `cwd`, preferring the `origin` remote. Uses
 * `execFileSync` (an argv array, never a shell string) so there is no
 * command-injection surface even though `cwd` is caller-controlled.
 * Falls back to parsing `.git/config` directly if the `git` binary isn't
 * on PATH — git is a convenience, never a hard requirement.
 */
export function detectGitRemote(cwd: string): string | null {
  try {
    const url = execFileSync("git", ["remote", "get-url", "origin"], {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    return url || null;
  } catch {
    return detectGitRemoteFromConfigFile(cwd);
  }
}

function detectGitRemoteFromConfigFile(cwd: string): string | null {
  const configPath = join(cwd, ".git", "config");
  if (!existsSync(configPath)) return null;
  try {
    const content = readFileSync(configPath, "utf8");
    const match = content.match(/\[remote "origin"\][^[]*url\s*=\s*(\S+)/);
    return match?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
}

export function isInsideGitRepo(cwd: string): boolean {
  return existsSync(join(cwd, ".git"));
}
