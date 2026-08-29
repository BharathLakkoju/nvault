import { apiRequestWith, normalizeApiBaseUrl, ApiError } from "../lib/api-client";
import { writeCredentials } from "../lib/config-dir";
import { envConfig } from "../lib/env";
import { promptHidden, promptText } from "../lib/prompt";
import { color, symbols } from "../lib/colors";

export interface LoginOptions {
  token?: string;
  apiUrl?: string;
}

interface MeResponse {
  user: { id: string; email: string; name: string | null };
}

/**
 * Authenticates the CLI with a Personal Access Token created in the web app
 * (Settings → CLI Tokens). No account password is ever typed into the
 * terminal, and the token is verified against the server before anything is
 * written to disk.
 */
export async function loginCommand(options: LoginOptions): Promise<void> {
  const nonInteractive = !process.stdin.isTTY;

  const envApiUrl = envConfig.apiUrl();
  let apiBaseUrl = options.apiUrl
    ? normalizeApiBaseUrl(options.apiUrl)
    : envApiUrl
      ? normalizeApiBaseUrl(envApiUrl)
      : "";
  if (!apiBaseUrl) {
    if (nonInteractive) {
      throw new Error("Pass --api-url <url> (or set NVAULT_API_URL) when logging in non-interactively.");
    }
    const answer = await promptText("nvault URL (e.g. https://vault.example.com): ");
    if (!answer.trim()) throw new Error("An nvault URL is required.");
    apiBaseUrl = normalizeApiBaseUrl(answer);
  }

  let token = options.token ?? envConfig.token() ?? "";
  if (!token) {
    if (nonInteractive) {
      throw new Error("Pass --token <token> (or set NVAULT_TOKEN) when logging in non-interactively.");
    }
    console.log(`\nCreate a token at ${color.cyan(`${apiBaseUrl.replace(/\/api\/v\d+$/, "")}/settings/tokens`)}\n`);
    token = (await promptHidden("Paste your access token: ")).trim();
  }
  if (!token.startsWith("evk_")) {
    throw new Error("That doesn't look like an nvault access token (expected an `evk_…` value).");
  }

  let me: MeResponse;
  try {
    me = await apiRequestWith<MeResponse>(apiBaseUrl, token, "/auth/me");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      throw new Error("That token was rejected. It may be revoked, expired, or for a different server.");
    }
    throw err;
  }

  writeCredentials({ apiBaseUrl, token, userEmail: me.user.email });
  console.log(`\n${symbols.check} Logged in as ${me.user.email}`);
}
