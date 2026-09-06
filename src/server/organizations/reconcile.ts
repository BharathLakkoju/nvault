import { INVITE_TTL_MS } from "../organizations/invites";
import { db } from "../db";
import { audit } from "../audit";

export interface ReconcileResult {
  expiredMemberships: number;
  flaggedPartialEnrollments: number;
  flaggedActiveWithoutKey: number;
}

/**
 * Safe server-side enrollment housekeeping. Never touches roster ciphertext or
 * wrapped keys — only membership lifecycle state and audit flags.
 */
export async function reconcileOrganizationEnrollment(): Promise<ReconcileResult> {
  const cutoff = new Date(Date.now() - INVITE_TTL_MS);

  const expiredMemberships = await db.organizationMembership.updateMany({
    where: { status: "INVITED", createdAt: { lt: cutoff } },
    data: { status: "EXPIRED" },
  });

  const partial = await db.organizationMembership.findMany({
    where: {
      status: "INVITED",
      OR: [{ wrappedOrgKeyCiphertext: { not: null } }, { keyGrantedAt: { not: null } }],
    },
    select: { id: true, organizationId: true, userId: true },
  });
  for (const row of partial) {
    await audit({
      organizationId: row.organizationId,
      userId: row.userId,
      action: "org.enrollment_mismatch",
      targetType: "membership",
      targetId: row.id,
      metadata: { reason: "partial_enrollment_artifacts" },
    });
  }

  const activeWithoutKey = await db.organizationMembership.findMany({
    where: { status: "ACTIVE", wrappedOrgKeyCiphertext: null },
    select: { id: true, organizationId: true, userId: true },
  });
  for (const row of activeWithoutKey) {
    await audit({
      organizationId: row.organizationId,
      userId: row.userId,
      action: "org.enrollment_mismatch",
      targetType: "membership",
      targetId: row.id,
      metadata: { reason: "active_without_wrapped_org_key" },
    });
  }

  return {
    expiredMemberships: expiredMemberships.count,
    flaggedPartialEnrollments: partial.length,
    flaggedActiveWithoutKey: activeWithoutKey.length,
  };
}

/** @deprecated Use {@link reconcileOrganizationEnrollment}. */
export async function countEnrollmentMismatches(): Promise<number> {
  const result = await reconcileOrganizationEnrollment();
  return result.flaggedPartialEnrollments + result.flaggedActiveWithoutKey;
}
