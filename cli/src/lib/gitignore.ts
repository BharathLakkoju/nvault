import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const RECOMMENDED_BLOCK = [".env", ".env.*", "!.env.example"];

/**
 * Best-effort check for whether `.gitignore` already covers dotenv-style
 * files. Not a full gitignore-pattern engine — just enough to catch the
 * common cases and avoid nagging the user when they've already handled it.
 */
export function isEnvIgnored(cwd: string): boolean {
  const path = join(cwd, ".gitignore");
  if (!existsSync(path)) return false;
  const lines = readFileSync(path, "utf8")
    .split("\n")
    .map((l) => l.trim());
  return lines.some((l) => l === ".env" || l === ".env*" || l === ".env.*" || l === "*.env");
}

export function appendEnvIgnoreRules(cwd: string): void {
  const path = join(cwd, ".gitignore");
  const exists = existsSync(path);
  const prefix = exists ? "\n" : "";
  appendFileSync(path, `${prefix}${RECOMMENDED_BLOCK.join("\n")}\n`);
}
