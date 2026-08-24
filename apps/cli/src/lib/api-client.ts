import { readCredentials, writeCredentials, type StoredCredentials } from "./config-dir";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly issues?: Array<{ path: string; message: string }>,
    /** OAuth-device-flow-style machine-readable error code, when present. */
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class NotLoggedInError extends Error {
  constructor() {
    super("Not logged in. Run `envvault login` first.");
    this.name = "NotLoggedInError";
  }
}

function apiBaseUrl(): string {
  return process.env.ENVVAULT_API_URL ?? readCredentials()?.apiBaseUrl ?? "http://localhost:4000/api/v1";
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean; // default true
  skipAuthRetry?: boolean;
}

async function rawRequest<T>(path: string, options: RequestOptions, accessToken?: string): Promise<T> {
  const res = await fetch(`${apiBaseUrl()}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 204) return undefined as T;
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? ((await res.json().catch(() => undefined)) as Record<string, any> | undefined) : undefined;

  if (!res.ok) {
    throw new ApiError(res.status, data?.message ?? res.statusText, data?.issues, data?.error);
  }
  return data as T;
}

/** Public, unauthenticated request (login/register/device flow). */
export function publicRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return rawRequest<T>(path, options);
}

async function refreshAccessToken(creds: StoredCredentials): Promise<StoredCredentials> {
  const result = await rawRequest<{ accessToken: string; accessTokenExpiresInSeconds: number; refreshToken?: string }>(
    "/auth/refresh",
    { method: "POST", body: { refreshToken: creds.refreshToken }, skipAuthRetry: true },
  );
  const updated: StoredCredentials = {
    ...creds,
    accessToken: result.accessToken,
    accessTokenExpiresAt: new Date(Date.now() + result.accessTokenExpiresInSeconds * 1000).toISOString(),
    refreshToken: result.refreshToken ?? creds.refreshToken,
  };
  writeCredentials(updated);
  return updated;
}

/** Authenticated request using the stored session; refreshes the access token transparently. */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let creds = readCredentials();
  if (!creds?.accessToken) throw new NotLoggedInError();

  try {
    return await rawRequest<T>(path, options, creds.accessToken);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && !options.skipAuthRetry) {
      creds = await refreshAccessToken(creds);
      return rawRequest<T>(path, options, creds.accessToken);
    }
    throw err;
  }
}
