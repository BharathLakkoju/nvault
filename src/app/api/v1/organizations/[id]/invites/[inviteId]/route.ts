import { audit } from "@/server/audit";
import { requireAuth } from "@/server/auth/require-auth";
import { authorizeOrg } from "@/server/authz/org-access";
import { clientIp, handler, noContent } from "@/server/http";
import { revokeInvite } from "@/server/organizations/invites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const DELETE = handler(async (req, { params }) => {
  const auth = await requireAuth(req);
  await authorizeOrg(auth.userId, params.id, "ADMIN");
  await revokeInvite(params.id, params.inviteId);
  await audit({
    userId: auth.userId,
    organizationId: params.id,
    action: "org.invite_revoked",
    targetType: "invite",
    targetId: params.inviteId,
    ipAddress: clientIp(req),
  });
  return noContent();
});
