import { audit } from "@/server/audit";
import { requireAuth } from "@/server/auth/require-auth";
import { revokeSession } from "@/server/auth/session";
import { handler, noContent } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const DELETE = handler(async (req, { params }) => {
  const auth = await requireAuth(req);
  await revokeSession(auth.userId, params.id);
  await audit({
    userId: auth.userId,
    action: "session.revoked",
    targetType: "session",
    targetId: params.id,
  });
  return noContent();
});
