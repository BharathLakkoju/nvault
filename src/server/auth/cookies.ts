import { NextResponse, type NextRequest } from "next/server";
import { env } from "../env";

/**
 * httpOnly refresh-token cookie. Scoped to `/api/v1/auth` so it is only ever
 * sent to the refresh/logout endpoints, never to the rest of the API.
 */
export const REFRESH_COOKIE_NAME = "evrt";
const COOKIE_PATH = "/api/v1/auth";

export function setRefreshCookie(res: NextResponse, token: string, maxAgeSeconds: number): void {
  res.cookies.set(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: COOKIE_PATH,
    maxAge: maxAgeSeconds,
  });
}

export function clearRefreshCookie(res: NextResponse): void {
  res.cookies.set(REFRESH_COOKIE_NAME, "", { path: COOKIE_PATH, maxAge: 0 });
}

export function readRefreshCookie(req: NextRequest): string | undefined {
  return req.cookies.get(REFRESH_COOKIE_NAME)?.value;
}
