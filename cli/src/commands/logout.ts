import { apiRequest } from "../lib/api-client";
import { clearCredentials, readCredentials } from "../lib/config-dir";
import { symbols } from "../lib/colors";

export async function logoutCommand(): Promise<void> {
  const creds = readCredentials();
  if (!creds) {
    console.log("Already logged out.");
    return;
  }

  try {
    await apiRequest<void>("/auth/logout", { method: "POST" });
  } catch {
    // Local logout still proceeds if the server is unreachable or the token was already revoked.
  }

  clearCredentials();
  console.log(`${symbols.check} Logged out — this device's token has been revoked on the server.`);
}
