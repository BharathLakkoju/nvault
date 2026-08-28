import { clearCredentials, readCredentials } from "../lib/config-dir";
import { symbols } from "../lib/colors";

export async function logoutCommand(): Promise<void> {
  if (!readCredentials()) {
    console.log("Already logged out.");
    return;
  }
  clearCredentials();
  console.log(`${symbols.check} Logged out on this machine`);
  console.log(
    "The access token itself is still valid — revoke it from Settings → CLI Tokens in the web app if this device is compromised.",
  );
}
