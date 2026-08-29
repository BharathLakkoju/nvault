import { GrantKeyRequestSchema } from "@/lib/schemas";
import { audit } from "@/server/audit";
import { requireAuth } from "@/server/auth/require-auth";
import { authorizeOrg } from "@/server/authz/org-access";
import { clientIp, handler, json, readJson } from "@/server/http";
import { grantKey } from "@/server/organizations/members";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req, { params }) => {
  const auth = await requireAuth(req);
  const actor = await authorizeOrg(auth.userId, params.id, "ADMIN");
  const dto = await readJson(req, GrantKeyRequestSchema);
  const updated = await grantKey(params.id, actor, params.membershipId, dto);
  await audit({
    userId: auth.userId,
    organizationId: params.id,
    action: "org.member_key_granted",
    targetType: "membership",
    targetId: updated.id,
    metadata: { targetUserId: updated.userId, keyEpoch: dto.keyEpoch },
    ipAddress: clientIp(req),
  });
  return json({ membership: { id: updated.id, status: updated.status } });
});
