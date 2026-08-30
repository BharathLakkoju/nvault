import { CreateApiTokenRequestSchema } from "@/lib/schemas";
import { audit } from "@/server/audit";
import { createApiToken, listApiTokens } from "@/server/auth/api-tokens";
import { requireAuth } from "@/server/auth/require-auth";
import { userHasCliAccess } from "@/server/billing/service";
import { clientIp, handler, json, readJson } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (req) => {
  const auth = await requireAuth(req);
  const [tokens, cliAccess] = await Promise.all([
    listApiTokens(auth.userId),
    userHasCliAccess(auth.userId),
  ]);
  return json({
    // Whether this account may create new CLI tokens (Pro / Team). Already-issued
    // tokens keep working regardless; this only gates creation.
    cliAccess,
    tokens: tokens.map((t) => ({
      id: t.id,
      name: t.name,
      tokenPrefix: t.tokenPrefix,
      createdAt: t.createdAt,
      lastUsedAt: t.lastUsedAt,
      expiresAt: t.expiresAt,
      revokedAt: t.revokedAt,
    })),
  });
});

export const POST = handler(async (req) => {
  const auth = await requireAuth(req);
  const dto = await readJson(req, CreateApiTokenRequestSchema);
  const hasCliAccess = await userHasCliAccess(auth.userId);
  const created = await createApiToken(auth.userId, dto, { hasCliAccess });
  await audit({
    userId: auth.userId,
    action: "apitoken.created",
    targetType: "apitoken",
    targetId: created.id,
    metadata: { name: created.name },
    ipAddress: clientIp(req),
  });
  return json(
    {
      // `token` is the only time the raw value is ever returned.
      token: created.token,
      apiToken: {
        id: created.id,
        name: created.name,
        tokenPrefix: created.tokenPrefix,
        createdAt: created.createdAt,
        expiresAt: created.expiresAt,
      },
    },
    201,
  );
});
