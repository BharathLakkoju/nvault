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
  const ip = clientIp(req);
  await enforceRateLimit(`auth/register:${ip ?? "unknown"}`, { limit: 10, windowMs: 60_000 });

  const dto = await readJson(req, RegisterRequestSchema);
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
    },
    { status: 201 },
  );
  setRefreshCookie(res, result.tokens.refreshToken, env.REFRESH_TOKEN_TTL_SECONDS);
  return res;
});
