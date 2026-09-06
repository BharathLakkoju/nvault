import { NextResponse } from "next/server";
import { LoginRequestSchema } from "@/lib/schemas";
import { login } from "@/server/auth/service";
import { setRefreshCookie } from "@/server/auth/cookies";
import { env } from "@/server/env";
import { clientIp, handler, readJson } from "@/server/http";
import { enforceRateLimit } from "@/server/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req) => {
  const dto = await readJson(req, LoginRequestSchema);
  const ip = clientIp(req);
  await enforceRateLimit(`auth/login:${ip ?? "unknown"}`, { limit: 10, windowMs: 60_000 });
  await enforceRateLimit(`auth/login-email:${dto.email}`, { limit: 20, windowMs: 15 * 60_000 });
  const result = await login(dto, {
    ipAddress: ip,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  const res = NextResponse.json({
    accessToken: result.tokens.accessToken,
    accessTokenExpiresInSeconds: result.tokens.accessTokenExpiresInSeconds,
    user: result.user,
    vaultKeyMaterial: result.vaultKeyMaterial,
    keyPairMaterial: result.keyPairMaterial,
  });
  res.headers.set("Cache-Control", "no-store, private");
  setRefreshCookie(res, result.tokens.refreshToken, env.REFRESH_TOKEN_TTL_SECONDS);
  return res;
});
