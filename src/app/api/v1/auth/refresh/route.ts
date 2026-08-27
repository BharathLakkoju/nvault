import { NextResponse } from "next/server";
import { me } from "@/server/auth/service";
import { rotateRefreshToken } from "@/server/auth/session";
import { verifyAccessToken } from "@/server/auth/tokens";
import { readRefreshCookie, setRefreshCookie } from "@/server/auth/cookies";
import { RefreshRequestSchema } from "@/server/auth/dto";
import { env } from "@/server/env";
import { ApiError, clientIp, handler, readJsonOptional } from "@/server/http";
import { enforceRateLimit } from "@/server/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req) => {
  const ip = clientIp(req);
  await enforceRateLimit(`auth/refresh:${ip ?? "unknown"}`, { limit: 30, windowMs: 60_000 });

  const cookieToken = readRefreshCookie(req);
  const body = await readJsonOptional(req, RefreshRequestSchema);
  const refreshToken = cookieToken ?? body.refreshToken;
  if (!refreshToken) throw new ApiError(401, "Missing refresh token");

  const tokens = await rotateRefreshToken(refreshToken);
  const payload = await verifyAccessToken(tokens.accessToken);
  const profile = await me(payload.sub);

  const res = NextResponse.json({
    accessToken: tokens.accessToken,
    accessTokenExpiresInSeconds: tokens.accessTokenExpiresInSeconds,
    user: profile.user,
    vaultKeyMaterial: profile.vaultKeyMaterial,
    // Only for non-cookie callers; a browser gets the rotated token as a cookie.
    refreshToken: cookieToken ? undefined : tokens.refreshToken,
  });
  if (cookieToken) {
    setRefreshCookie(res, tokens.refreshToken, env.REFRESH_TOKEN_TTL_SECONDS);
  }
  return res;
});
