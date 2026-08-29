import { TransferOwnershipRequestSchema } from "@/lib/schemas";
import { audit } from "@/server/audit";
import { requireAuth } from "@/server/auth/require-auth";
import { authorizeOrg } from "@/server/authz/org-access";
import { clientIp, handler, json, readJson } from "@/server/http";
import { transferOwnership } from "@/server/organizations/members";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req, { params }) => {
  const auth = await requireAuth(req);
  const actor = await authorizeOrg(auth.userId, params.id, "OWNER");
  const dto = await readJson(req, TransferOwnershipRequestSchema);
  const result = await transferOwnership(params.id, actor, dto.toMembershipId);
  await audit({
    userId: auth.userId,
    organizationId: params.id,
    action: "org.ownership_transferred",
    targetType: "membership",
    targetId: dto.toMembershipId,
    metadata: { newOwnerUserId: result.newOwnerUserId },
    ipAddress: clientIp(req),
  });
  return json({ ok: true });
});
