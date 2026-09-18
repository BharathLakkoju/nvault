import { apiRequestWith, normalizeApiBaseUrl, ApiError } from "../lib/api-client";
import { writeCredentials } from "../lib/config-dir";
import { envConfig } from "../lib/env";
import { promptHidden, promptText } from "../lib/prompt";
import { color, symbols } from "../lib/colors";

export interface LoginOptions {
  token?: string;
  apiUrl?: string;
}

interface DeviceStartResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

interface DevicePollResponse {
  token: string;
  user: { email: string };
}

interface DevicePollError {
  error: string;
}

async function rawRequest<T>(baseUrl: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => undefined)) as T | DevicePollError | undefined;
  if (!res.ok) {
    const errBody = data as DevicePollError | undefined;
    if (errBody?.error === "authorization_pending") {
      throw new DevicePendingError();
    }
    if (errBody?.error === "slow_down") {
      throw new DeviceSlowDownError();
    }
    const message =
      (data as { message?: string } | undefined)?.message ??
      errBody?.error ??
      `${res.status} ${res.statusText}`;
    throw new ApiError(res.status, message);
  }
  return data as T;
}

class DevicePendingError extends Error {
  constructor() {
    super("authorization_pending");
    this.name = "DevicePendingError";
  }
}

class DeviceSlowDownError extends Error {
  constructor() {
    super("slow_down");
    this.name = "DeviceSlowDownError";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loginWithDeviceCode(apiBaseUrl: string): Promise<void> {
  const started = await rawRequest<DeviceStartResponse>(apiBaseUrl, "/auth/device", {
    clientName: "nvault CLI",
  });

  console.log(`\nOpen:\n  ${color.cyan(started.verification_uri_complete)}\n`);
  console.log(`Code:  ${color.bold(started.user_code)}\n`);
  console.log("Waiting for authentication…");

  const deadline = Date.now() + started.expires_in * 1000;
  let intervalMs = started.interval * 1000;

  while (Date.now() < deadline) {
    await sleep(intervalMs);
    try {
      const result = await rawRequest<DevicePollResponse>(apiBaseUrl, "/auth/device/token", {
        device_code: started.device_code,
      });
      writeCredentials({ apiBaseUrl, token: result.token, userEmail: result.user.email });
      console.log(`\n${symbols.check} Device authenticated as ${result.user.email}`);
      return;
    } catch (err) {
      if (err instanceof DevicePendingError) continue;
      if (err instanceof DeviceSlowDownError) {
        intervalMs = Math.min(intervalMs * 1.5, 15_000);
        continue;
      }
      if (err instanceof ApiError && err.message === "expired_token") {
        throw new Error("The device code expired. Run `nvault login` again.");
      }
      if (err instanceof ApiError && err.message === "access_denied") {
        throw new Error("Device authorization was denied.");
      }
      if (err instanceof ApiError && err.status === 402) {
        throw new Error("CLI access requires a Pro or Team plan. Upgrade in the web app, then try again.");
      }
      throw err;
    }
  }

  throw new Error("Timed out waiting for device approval. Run `nvault login` again.");
}

/**
 * Authenticates the CLI. By default uses the browser device-code flow (no
 * password in the terminal). Pass `--token` for CI or headless environments.
 */
export async function loginCommand(options: LoginOptions): Promise<void> {
  const nonInteractive = !process.stdin.isTTY;
  const explicitToken = options.token ?? envConfig.token();

  if (explicitToken) {
    return loginWithToken(options);
  }

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

  if (nonInteractive) {
    throw new Error("Pass --token <token> (or set NVAULT_TOKEN) when logging in non-interactively.");
  }

  await loginWithDeviceCode(apiBaseUrl);
}

async function loginWithToken(options: LoginOptions): Promise<void> {
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

  let me: { user: { email: string } };
  try {
    me = await apiRequestWith<{ user: { email: string } }>(apiBaseUrl, token, "/auth/me");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      throw new Error("That token was rejected. It may be revoked, expired, or for a different server.");
    }
    throw err;
  }

  writeCredentials({ apiBaseUrl, token, userEmail: me.user.email });
  console.log(`\n${symbols.check} Logged in as ${me.user.email}`);
}
