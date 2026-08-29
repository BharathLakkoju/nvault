import { AcceptInviteRequestSchema } from "@/lib/schemas";
import { audit } from "@/server/audit";
import { requireAuth } from "@/server/auth/require-auth";
import { clientIp, handler, json, readJson, ApiError } from "@/server/http";
import { enforceRateLimit } from "@/server/ratelimit";
import { findUserById } from "@/server/users";
import { acceptInvite } from "@/server/organizations/invites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req) => {
  const auth = await requireAuth(req);
  const ip = clientIp(req);
  await enforceRateLimit(`invite/accept:${ip ?? "unknown"}`, { limit: 20, windowMs: 60_000 });

  const dto = await readJson(req, AcceptInviteRequestSchema);
  const user = await findUserById(auth.userId);
  if (!user) throw new ApiError(401, "Unauthorized");

  const result = await acceptInvite(auth.userId, user.email, dto.token);

  await audit({
    userId: auth.userId,
    organizationId: result.organizationId,
    action: "org.member_joined",
    targetType: "membership",
    targetId: result.membershipId,
    metadata: { role: result.role },
    ipAddress: ip,
  });

  return json({
    organization: { id: result.organizationId, name: result.organizationName },
    role: result.role,
  });
});
