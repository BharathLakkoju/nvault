import type { OrgRole, OrganizationMembership } from "@/generated/prisma/client";
import { db } from "../db";
import { ApiError } from "../http";
import { canActOnRole } from "../authz/roles";

async function getTargetMembership(
  orgId: string,
  membershipId: string,
): Promise<OrganizationMembership> {
  const target = await db.organizationMembership.findUnique({ where: { id: membershipId } });
  if (!target || target.organizationId !== orgId) {
    throw new ApiError(404, "Member not found");
  }
  return target;
}

async function ownerCount(orgId: string): Promise<number> {
  return db.organizationMembership.count({ where: { organizationId: orgId, role: "OWNER" } });
}

/**
 * Grants (or re-grants) the Org Key to a member. `wrappedOrgKey` is opaque
 * ciphertext produced by an admin's client (Org Key wrapped to the target's
 * public key). The server verifies only the epoch and the actor's role — it
 * cannot check that the blob decrypts correctly, so a buggy/malicious admin
 * can lock one member out (DoS), never disclose anything.
 */
export async function grantKey(
  orgId: string,
  actor: OrganizationMembership,
  membershipId: string,
  input: { wrappedOrgKey: string; keyEpoch: number },
): Promise<OrganizationMembership> {
  const target = await getTargetMembership(orgId, membershipId);

  const org = await db.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: { currentKeyEpoch: true },
  });
  if (input.keyEpoch !== org.currentKeyEpoch) {
    throw new ApiError(409, "The organization key has changed. Reload and try again.");
  }
  // An admin cannot grant a key to someone above their own role.
  if (target.userId !== actor.userId && !canActOnRole(actor.role, target.role) && actor.role !== "OWNER") {
    throw new ApiError(403, "You can't manage a member at your own role or higher.");
  }

  return db.organizationMembership.update({
    where: { id: membershipId },
    data: {
      wrappedOrgKeyCiphertext: input.wrappedOrgKey,
      keyEpoch: input.keyEpoch,
      status: "ACTIVE",
      keyGrantedAt: new Date(),
    },
  });
}

export async function changeRole(
  orgId: string,
  actor: OrganizationMembership,
  membershipId: string,
  newRole: OrgRole,
): Promise<OrganizationMembership> {
  const target = await getTargetMembership(orgId, membershipId);

  if (target.userId === actor.userId) {
    throw new ApiError(400, "You can't change your own role.");
  }
  if (!canActOnRole(actor.role, target.role) || !canActOnRole(actor.role, newRole)) {
    throw new ApiError(403, "You can only assign roles below your own.");
  }
  if (target.role === "OWNER" && newRole !== "OWNER" && (await ownerCount(orgId)) <= 1) {
    throw new ApiError(409, "An organization must have at least one owner.");
  }

  return db.organizationMembership.update({ where: { id: membershipId }, data: { role: newRole } });
}

export interface RemoveResult {
  removedUserId: string;
  wasSelf: boolean;
  /** The org key should be rotated so the removed member loses access to future reads. */
  rotationRequired: boolean;
}

export async function removeMember(
  orgId: string,
  actor: OrganizationMembership,
  membershipId: string,
): Promise<RemoveResult> {
  const target = await getTargetMembership(orgId, membershipId);
  const wasSelf = target.userId === actor.userId;

  if (!wasSelf) {
    if (!canActOnRole(actor.role, target.role)) {
      throw new ApiError(403, "You can only remove members below your own role.");
    }
  }
  if (target.role === "OWNER" && (await ownerCount(orgId)) <= 1) {
    throw new ApiError(
      409,
      wasSelf
        ? "Transfer ownership before leaving — an organization must have an owner."
        : "An organization must have at least one owner.",
    );
  }

  await db.organizationMembership.delete({ where: { id: membershipId } });
  return { removedUserId: target.userId, wasSelf, rotationRequired: target.status === "ACTIVE" };
}

export async function transferOwnership(
  orgId: string,
  actor: OrganizationMembership,
  toMembershipId: string,
): Promise<{ newOwnerUserId: string }> {
  if (actor.role !== "OWNER") {
    throw new ApiError(403, "Only an owner can transfer ownership.");
  }
  const target = await getTargetMembership(orgId, toMembershipId);
  if (target.userId === actor.userId) {
    throw new ApiError(400, "You are already the owner.");
  }
  if (target.status !== "ACTIVE") {
    throw new ApiError(409, "The new owner must be an active member with organization key access.");
  }

  // No interactive transaction (pooler). Promote first: a brief window with
  // two owners is safe; a window with zero owners is not.
  await db.organizationMembership.update({ where: { id: target.id }, data: { role: "OWNER" } });
  await db.organizationMembership.update({ where: { id: actor.id }, data: { role: "ADMIN" } });
  return { newOwnerUserId: target.userId };
}
