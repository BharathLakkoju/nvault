import { readCredentials } from "./config-dir";
import { envConfig } from "./env";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly issues?: Array<{ path: string; message: string }>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class NotLoggedInError extends Error {
  constructor() {
    super("Not logged in. Run `nvault login --token <token>` first.");
    this.name = "NotLoggedInError";
  }
}

/** Trailing-slash-trimmed base URL, with `/api/v1` appended if the user passed a bare origin. */
export function normalizeApiBaseUrl(raw: string): string {
  let url = raw.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  if (!/\/api\/v\d+$/.test(url)) url = `${url}/api/v1`;
  return url;
}

interface Resolved {
  baseUrl: string;
  token: string;
}

/** Env vars win over the stored file (the CI / ephemeral-shell path). */
function resolveAuth(): Resolved {
  const creds = readCredentials();
  const envToken = envConfig.token();
  const envApiUrl = envConfig.apiUrl();
  const token = envToken ?? creds?.token;
  const rawBase = envApiUrl ?? creds?.apiBaseUrl;
  if (!token || !rawBase) throw new NotLoggedInError();
  return {
    token,
    baseUrl: envApiUrl ? normalizeApiBaseUrl(rawBase) : rawBase,
  };
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
}

async function rawRequest<T>(
  baseUrl: string,
  path: string,
  options: RequestOptions,
  token?: string,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch (err) {
    throw new ApiError(0, `Could not reach ${baseUrl} — ${(err as Error).message}`);
  }

  if (res.status === 204) return undefined as T;
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson
    ? ((await res.json().catch(() => undefined)) as Record<string, unknown> | undefined)
    : undefined;

  if (!res.ok) {
    const message = (data?.message as string) ?? `${res.status} ${res.statusText}`;
    throw new ApiError(
      res.status,
      message,
      data?.issues as Array<{ path: string; message: string }> | undefined,
    );
  }
  return data as T;
}

/** Authenticated request using the stored token. */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { baseUrl, token } = resolveAuth();
  return rawRequest<T>(baseUrl, path, options, token);
}

/** One-off authenticated request with an explicit base URL + token (used by `login`). */
export async function apiRequestWith<T>(
  baseUrl: string,
  token: string,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  return rawRequest<T>(baseUrl, path, options, token);
}
