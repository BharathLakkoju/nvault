import { requireAuth } from "@/server/auth/require-auth";
import { getMembership } from "@/server/authz/org-access";
import { db } from "@/server/db";
import { ApiError, handler, json } from "@/server/http";
import { subscriptionToDto } from "@/server/billing/service";
import { teamTierInfo } from "@/server/billing/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Billing status for an org. Readable by any active member (they can see
 * whether the team is paid / lapsed); the `manageable` flag tells the client
 * whether THIS caller may open the portal. Works for PENDING_PAYMENT and
 * SUSPENDED orgs — that's the whole point of the billing page.
 */
export const GET = handler(async (req, { params }) => {
  const auth = await requireAuth(req);
  const membership = await getMembership(auth.userId, params.id);
  if (!membership || membership.status !== "ACTIVE") {
    throw new ApiError(404, "Organization not found");
  }
  const org = await db.organization.findUniqueOrThrow({
    where: { id: params.id },
    include: { subscription: true, _count: { select: { memberships: true } } },
  });
  return json({
    orgStatus: org.status,
    memberCount: org._count.memberships,
    tiers: teamTierInfo(),
    subscription: subscriptionToDto(org.subscription, auth.userId),
  });
});
