import { audit } from "@/server/audit";
import { requireAuth } from "@/server/auth/require-auth";
import { deletePasskey } from "@/server/auth/webauthn";
import { clientIp, handler, noContent } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const DELETE = handler(async (req, { params }) => {
  const auth = await requireAuth(req);
  await deletePasskey(auth.userId, params.id);
  await audit({
    userId: auth.userId,
    action: "passkey.revoked",
    targetType: "user",
    targetId: auth.userId,
    metadata: { credentialId: params.id },
    ipAddress: clientIp(req),
  });
  return noContent();
});
