import { UpdateMembershipRequestSchema } from "@/lib/schemas";
import { audit } from "@/server/audit";
import { requireAuth } from "@/server/auth/require-auth";
import { authorizeOrg } from "@/server/authz/org-access";
import { clientIp, handler, json, readJson, ApiError } from "@/server/http";
import { changeRole, removeMember } from "@/server/organizations/members";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = handler(async (req, { params }) => {
  const auth = await requireAuth(req);
  const actor = await authorizeOrg(auth.userId, params.id, "ADMIN");
  const dto = await readJson(req, UpdateMembershipRequestSchema);
  const updated = await changeRole(params.id, actor, params.membershipId, dto.role);
  await audit({
    userId: auth.userId,
    organizationId: params.id,
    action: "org.member_role_changed",
    targetType: "membership",
    targetId: updated.id,
    metadata: { targetUserId: updated.userId, role: updated.role },
    ipAddress: clientIp(req),
  });
  return json({ membership: { id: updated.id, role: updated.role } });
});

export const DELETE = handler(async (req, { params }) => {
  const auth = await requireAuth(req);
  // Any active member may remove themselves ("leave"); removing others needs
  // ADMIN+ (enforced in removeMember via canActOnRole).
  const actor = await authorizeOrg(auth.userId, params.id, "MEMBER");
  if (actor.id !== params.membershipId && actor.role === "MEMBER") {
    throw new ApiError(403, "You can only remove yourself from this organization.");
  }

  const result = await removeMember(params.id, actor, params.membershipId);
  await audit({
    userId: auth.userId,
    organizationId: params.id,
    action: "org.member_removed",
    targetType: "membership",
    targetId: params.membershipId,
    metadata: { targetUserId: result.removedUserId, wasSelf: result.wasSelf },
    ipAddress: clientIp(req),
  });
  return json({ rotationRequired: result.rotationRequired });
});
