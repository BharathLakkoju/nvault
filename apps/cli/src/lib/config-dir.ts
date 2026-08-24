import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync, unlinkSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

/**
 * OS-appropriate location for CLI state, following each platform's normal
 * convention for per-user application config (not a project directory, and
 * never the current working directory).
 */
export function getConfigDir(): string {
  const home = homedir();
  if (platform() === "win32") {
    return join(process.env.APPDATA ?? join(home, "AppData", "Roaming"), "envvault");
  }
  if (platform() === "darwin") {
    return join(home, "Library", "Application Support", "envvault");
  }
  return join(process.env.XDG_CONFIG_HOME ?? join(home, ".config"), "envvault");
}

function getCredentialsPath(): string {
  return join(getConfigDir(), "credentials.json");
}

export interface StoredCredentials {
  apiBaseUrl: string;
  accessToken: string;
  accessTokenExpiresAt: string; // ISO timestamp
  refreshToken: string;
  userEmail: string;
}

/**
 * Credentials are stored in a per-user config file with owner-only
 * permissions (chmod 600) — the closest we get to OS-keychain security
 * without adding a native keychain dependency. The vault passphrase and
 * master key are NEVER written here; they only ever live in this
 * process's memory for the duration of a single command.
 */
export function readCredentials(): StoredCredentials | null {
  const path = getCredentialsPath();
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
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
  const path = getCredentialsPath();
  if (existsSync(path)) unlinkSync(path);
}
