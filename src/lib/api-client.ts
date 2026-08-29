import { API_BASE_URL } from "./config";
import { useAuthStore } from "./auth-store";

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

/**
 * A 402 from the API — a plan limit was hit or an organization's
 * subscription is inactive. Carries the server's human-readable reason so
 * callers can show an upgrade / renew CTA instead of a generic error.
 */
export class PaywallError extends ApiError {
  constructor(message: string) {
    super(402, message);
    this.name = "PaywallError";
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** Set true for the refresh call itself, to avoid infinite retry loops. */
  skipAuthRetry?: boolean;
}

async function rawRequest<T>(path: string, options: RequestOptions): Promise<T> {
  const accessToken = useAuthStore.getState().accessToken;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    credentials: "include", // sends the httpOnly refresh-token cookie
    headers: {
      "content-type": "application/json",
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json().catch(() => undefined) : undefined;

  if (!res.ok) {
    const message = data?.message ?? res.statusText;
    if (res.status === 402) throw new PaywallError(message);
    throw new ApiError(res.status, message, data?.issues);
  }
  return data as T;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await rawRequest<T>(path, options);
  } catch (err) {
    const is401 = err instanceof ApiError && err.status === 401;
    if (is401 && !options.skipAuthRetry && path !== "/auth/refresh") {
      const refreshed = await useAuthStore.getState().tryRefresh();
      if (refreshed) {
        return rawRequest<T>(path, options);
      }
      useAuthStore.getState().clearSession();
    }
    throw err;
  }
}
