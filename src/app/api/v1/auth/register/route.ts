import { NextResponse } from "next/server";
import { RegisterRequestSchema } from "@/lib/schemas";
import { register } from "@/server/auth/service";
import { setRefreshCookie } from "@/server/auth/cookies";
import { env } from "@/server/env";
import { clientIp, handler, readJson } from "@/server/http";
import { enforceRateLimit } from "@/server/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req) => {
  const dto = await readJson(req, RegisterRequestSchema);
  const ip = clientIp(req);
  await enforceRateLimit(`auth/register:${ip ?? "unknown"}`, { limit: 10, windowMs: 60_000 });
  await enforceRateLimit(`auth/register-email:${dto.email}`, { limit: 5, windowMs: 60 * 60_000 });
  const result = await register(dto, {
    ipAddress: ip,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  const res = NextResponse.json(
    {
      accessToken: result.tokens.accessToken,
      accessTokenExpiresInSeconds: result.tokens.accessTokenExpiresInSeconds,
      user: result.user,
      vaultKeyMaterial: result.vaultKeyMaterial,
      keyPairMaterial: result.keyPairMaterial,
    },
    { status: 201 },
  );
  res.headers.set("Cache-Control", "no-store, private");
  setRefreshCookie(res, result.tokens.refreshToken, env.REFRESH_TOKEN_TTL_SECONDS);
  return res;
});
