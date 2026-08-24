import { apiRequest } from "../lib/api-client";
import { clearCredentials, readCredentials } from "../lib/config-dir";
import { symbols } from "../lib/colors";

export async function logoutCommand(): Promise<void> {
  if (!readCredentials()) {
    console.log("Already logged out.");
    return;
  }
  try {
    await apiRequest("/auth/logout", { method: "POST" });
  } catch {
    // Revoke locally even if the server call fails (e.g. offline) — the
    // user's intent to log out of *this device* should always succeed.
  } finally {
    clearCredentials();
  }
  console.log(`${symbols.check} Logged out`);
}
