import type { OrgRole, OrganizationMembership } from "@prisma/client";
import { db } from "../db";
import { ApiError } from "../http";
import { roleAtLeast } from "./roles";

/** Read vs. write intent, used to apply the billing gate (see below). */
export type OrgAccess = "read" | "write";

/**
 * Resolves the caller's ACTIVE membership in an org and checks it meets
 * `minRole`. Throws 404 (never 403) when the caller is not an active member
 * or the org does not exist, so neither can be probed.
 *
 * INVITED memberships (invite accepted, Org Key not yet granted) do NOT
 * satisfy this — such a member has no usable access yet. Use
 * {@link getMembership} for read-only "what's my status" views.
 *
 * Billing gate (`access`, default `"write"`):
 *   - `PENDING_PAYMENT` org  → 402 for both read and write.
 *   - `SUSPENDED` org        → reads allowed, writes 402.
 *   - `ACTIVE` org           → unchanged.
 * This is an authorization control — it is enforced here, on every
 * org-scoped operation, never in the client.
 */
export async function authorizeOrg(
  userId: string,
  orgId: string,
  minRole: OrgRole = "MEMBER",
  access: OrgAccess = "write",
): Promise<OrganizationMembership> {
  const membership = await db.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId } },
    include: { organization: { select: { status: true } } },
  });
  if (!membership || membership.status !== "ACTIVE") {
    throw new ApiError(404, "Organization not found");
  }
  if (!roleAtLeast(membership.role, minRole)) {
    throw new ApiError(403, "You do not have permission to do that in this organization.");
  }

  const orgStatus = membership.organization.status;
  if (orgStatus === "PENDING_PAYMENT") {
    throw new ApiError(
      402,
      "This organization isn't active yet — the owner needs to complete payment.",
    );
  }
  if (orgStatus === "SUSPENDED" && access === "write") {
    throw new ApiError(
      402,
      "This organization's subscription is inactive. The owner can renew it in the organization's billing settings.",
    );
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
