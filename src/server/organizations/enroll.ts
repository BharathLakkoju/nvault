import type { OrganizationMembership } from "@/generated/prisma/client";
import type { EnrollRequest } from "@/lib/schemas";
import { db } from "../db";
import { ApiError } from "../http";

export interface EnrollResult {
  membershipId: string;
  role: OrganizationMembership["role"];
  rosterVersion: number;
}

/**
 * Completes an INVITED member's join: they have recovered the Org Key with
 * the Enrollment Secret (client-side, server never sees it), re-wrapped it to
 * their own public key, and added their entry to the roster. This persists
 * all three and flips the membership to ACTIVE.
 *
 * The server validates only structure, not cryptographic correctness — it
 * cannot check that `wrappedOrgKey` decrypts or that the roster edit is
 * honest. A member who submits garbage only locks themselves out; the
 * `expectedRosterVersion` guard prevents them from clobbering a concurrent
 * enrollment's roster entry.
 */
export async function enrollMember(
  orgId: string,
  userId: string,
  input: EnrollRequest,
): Promise<EnrollResult> {
  const membership = await db.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId } },
    include: {
      organization: {
        select: { status: true, currentKeyEpoch: true, rosterVersion: true },
      },
    },
  });
  if (!membership) {
    throw new ApiError(404, "Organization not found");
  }
  if (membership.status === "EXPIRED") {
    throw new ApiError(409, "Your enrollment window expired. Ask an admin to send a new invite.");
  }
  if (membership.status === "ACTIVE") {
    throw new ApiError(409, "You have already enrolled in this organization.");
  }
  if (membership.organization.status !== "ACTIVE") {
    throw new ApiError(
      402,
      "This organization isn't active yet — the owner needs to complete payment.",
    );
  }
  if (input.keyEpoch !== membership.organization.currentKeyEpoch) {
    throw new ApiError(409, "The organization key has changed. Reload and try again.");
  }
  if (input.expectedRosterVersion !== membership.organization.rosterVersion) {
    throw new ApiError(409, "Someone else just joined. Reload and try again.");
  }

  const updated = await db.$transaction(async (tx) => {
    const bumped = await tx.organization.updateMany({
      where: { id: orgId, rosterVersion: input.expectedRosterVersion },
      data: {
        rosterIv: input.roster.iv,
        rosterCiphertext: input.roster.ciphertext,
        rosterVersion: input.expectedRosterVersion + 1,
      },
    });
    if (bumped.count === 0) {
      throw new ApiError(409, "Someone else just joined. Reload and try again.");
    }

    return tx.organizationMembership.update({
      where: { id: membership.id },
      data: {
        wrappedOrgKeyCiphertext: input.wrappedOrgKey,
        pinnedPublicKey: input.pinnedPublicKey,
        keyEpoch: input.keyEpoch,
        status: "ACTIVE",
        keyGrantedAt: new Date(),
      },
    });
  });

  return {
    membershipId: updated.id,
    role: updated.role,
    rosterVersion: input.expectedRosterVersion + 1,
  };
}
