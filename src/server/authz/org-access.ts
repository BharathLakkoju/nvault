import type { OrgRole, OrganizationMembership } from "@prisma/client";
import { db } from "../db";
import { ApiError } from "../http";
import { roleAtLeast } from "./roles";

/**
 * Resolves the caller's ACTIVE membership in an org and checks it meets
 * `minRole`. Throws 404 (never 403) when the caller is not an active member
 * or the org does not exist, so neither can be probed.
 *
 * INVITED memberships (invite accepted, Org Key not yet granted) do NOT
 * satisfy this — such a member has no usable access yet. Use
 * {@link getMembership} for read-only "what's my status" views.
 */
export async function authorizeOrg(
  userId: string,
  orgId: string,
  minRole: OrgRole = "MEMBER",
): Promise<OrganizationMembership> {
  const membership = await db.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId } },
  });
  if (!membership || membership.status !== "ACTIVE") {
    throw new ApiError(404, "Organization not found");
  }
  if (!roleAtLeast(membership.role, minRole)) {
    throw new ApiError(403, "You do not have permission to do that in this organization.");
  }
  return membership;
}

/** The caller's membership in an org (any status), or null. No error on miss. */
export function getMembership(
  userId: string,
  orgId: string,
): Promise<OrganizationMembership | null> {
  return db.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId } },
  });
}
