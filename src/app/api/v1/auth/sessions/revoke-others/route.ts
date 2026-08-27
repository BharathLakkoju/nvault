import { audit } from "@/server/audit";
import { requireAuth } from "@/server/auth/require-auth";
import { revokeAllExcept } from "@/server/auth/session";
import { handler, noContent } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req) => {
  const auth = await requireAuth(req);
  await revokeAllExcept(auth.userId, auth.sessionId);
  await audit({ userId: auth.userId, action: "session.revoked_all" });
  return noContent();
});
