import { EnrollRequestSchema } from "@/lib/schemas";
import { audit } from "@/server/audit";
import { requireAuth } from "@/server/auth/require-auth";
import { clientIp, handler, json, readJson } from "@/server/http";
import { enforceRateLimit } from "@/server/ratelimit";
import { enrollMember } from "@/server/organizations/enroll";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// An INVITED member completes their join here. Deliberately does NOT go
// through authorizeOrg (which requires an ACTIVE membership) — enrollMember
// resolves and checks the caller's INVITED membership itself.
export const POST = handler(async (req, { params }) => {
  const auth = await requireAuth(req);
  const ip = clientIp(req);
  await enforceRateLimit(`org/enroll:${params.id}`, { limit: 20, windowMs: 60 * 60_000 });
  await enforceRateLimit(`org/enroll-ip:${ip ?? "unknown"}`, { limit: 20, windowMs: 60_000 });

  const dto = await readJson(req, EnrollRequestSchema);
  const result = await enrollMember(params.id, auth.userId, dto);

  await audit({
    userId: auth.userId,
    organizationId: params.id,
    action: "org.member_enrolled",
    targetType: "membership",
    targetId: result.membershipId,
    metadata: { keyEpoch: dto.keyEpoch, rosterVersion: result.rosterVersion },
    ipAddress: ip,
  });

  return json({ membership: { id: result.membershipId, role: result.role, status: "ACTIVE" } });
});
