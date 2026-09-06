import { NextResponse } from "next/server";
import { me } from "@/server/auth/service";
import { refreshAccessToken, rotateRefreshToken } from "@/server/auth/session";
import { verifyAccessToken } from "@/server/auth/jwt";
import { readRefreshCookie, setRefreshCookie } from "@/server/auth/cookies";
import { RefreshRequestSchema } from "@/server/auth/dto";
import { appOrigin, env } from "@/server/env";
import { ApiError, assertSameOriginCookieAuth, clientIp, handler, readJsonOptional } from "@/server/http";
import { enforceRateLimit } from "@/server/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req) => {
  const ip = clientIp(req);
  await enforceRateLimit(`auth/refresh:${ip ?? "unknown"}`, { limit: 30, windowMs: 60_000 });

  const cookieToken = readRefreshCookie(req);
  if (cookieToken) {
    assertSameOriginCookieAuth(req, appOrigin());
  }
  const body = await readJsonOptional(req, RefreshRequestSchema);
  const refreshToken = cookieToken ?? body.refreshToken;
  if (!refreshToken) throw new ApiError(401, "Missing refresh token");

  // Cookie callers (the web app) get a non-rotating refresh — see
  // refreshAccessToken's comment. Non-cookie callers get a rotated token.
  const tokens = cookieToken
    ? await refreshAccessToken(refreshToken)
    : await rotateRefreshToken(refreshToken);
  const payload = await verifyAccessToken(tokens.accessToken);
  const profile = await me(payload.sub);

  const res = NextResponse.json({
    accessToken: tokens.accessToken,
    accessTokenExpiresInSeconds: tokens.accessTokenExpiresInSeconds,
    user: profile.user,
    vaultKeyMaterial: profile.vaultKeyMaterial,
    keyPairMaterial: profile.keyPairMaterial,
    refreshToken: cookieToken ? undefined : tokens.refreshToken,
  });
  res.headers.set("Cache-Control", "no-store, private");
  if (cookieToken) {
    setRefreshCookie(res, tokens.refreshToken, env.REFRESH_TOKEN_TTL_SECONDS);
  }
  return res;
});
