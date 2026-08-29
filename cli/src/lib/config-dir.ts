import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync, unlinkSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

/** App directory name, per platform convention. Legacy name kept for back-compat. */
const APP_DIR = "nvault";
const LEGACY_APP_DIR = "envvault";

function configRoot(): string {
  const home = homedir();
  if (platform() === "win32") {
    return process.env.APPDATA ?? join(home, "AppData", "Roaming");
  }
  if (platform() === "darwin") {
    return join(home, "Library", "Application Support");
  }
  return process.env.XDG_CONFIG_HOME ?? join(home, ".config");
}

/**
 * OS-appropriate location for CLI state, following each platform's normal
 * convention for per-user application config (not a project directory, and
 * never the current working directory).
 */
export function getConfigDir(): string {
  return join(configRoot(), APP_DIR);
}

/** Pre-rename location (`envvault`). Read-only fallback so existing logins survive the rename. */
function getLegacyConfigDir(): string {
  return join(configRoot(), LEGACY_APP_DIR);
}

function getCredentialsPath(): string {
  return join(getConfigDir(), "credentials.json");
}

function getLegacyCredentialsPath(): string {
  return join(getLegacyConfigDir(), "credentials.json");
}

export interface StoredCredentials {
  apiBaseUrl: string;
  /**
   * A Personal Access Token minted in the web app
   * (Settings → CLI Tokens). Long-lived, opaque, and only ever sent over
   * TLS as a bearer token. The vault passphrase / master key is NEVER
   * written here — it only lives in a single command's process memory.
   */
  token: string;
  userEmail: string;
}

function parseCredentialsFile(path: string): StoredCredentials | null {
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<StoredCredentials>;
    if (!parsed.token || !parsed.apiBaseUrl) return null;
    return {
      apiBaseUrl: parsed.apiBaseUrl,
      token: parsed.token,
      userEmail: parsed.userEmail ?? "",
    };
  } catch {
    return null;
  }
}

/**
 * Credentials live in a per-user config file with owner-only permissions
 * (chmod 600) — the closest we get to OS-keychain security without adding a
 * native keychain dependency. `NVAULT_TOKEN` / `NVAULT_API_URL` in the
 * environment take precedence and touch nothing on disk (the CI path).
 *
 * Falls back to the pre-rename `envvault` config directory (read-only) so an
 * upgrade doesn't silently log the user out; the next `login` writes to the
 * new location.
 */
export function readCredentials(): StoredCredentials | null {
  return parseCredentialsFile(getCredentialsPath()) ?? parseCredentialsFile(getLegacyCredentialsPath());
}

export function writeCredentials(creds: StoredCredentials): void {
  const dir = getConfigDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  const path = getCredentialsPath();
  writeFileSync(path, JSON.stringify(creds, null, 2), { mode: 0o600 });
  if (platform() !== "win32") {
    try {
      chmodSync(path, 0o600);
    } catch {
      // best effort
    }
  }
}

export function clearCredentials(): void {
  for (const path of [getCredentialsPath(), getLegacyCredentialsPath()]) {
    if (existsSync(path)) unlinkSync(path);
  }
}
