import { audit } from "@/server/audit";
import { revokeApiToken } from "@/server/auth/api-tokens";
import { requireAuth } from "@/server/auth/require-auth";
import { clientIp, handler, noContent } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const DELETE = handler(async (req, { params }) => {
  const auth = await requireAuth(req);
  await revokeApiToken(auth.userId, params.id);
  await audit({
    userId: auth.userId,
    action: "apitoken.revoked",
    targetType: "apitoken",
    targetId: params.id,
    ipAddress: clientIp(req),
  });
  return noContent();
});
