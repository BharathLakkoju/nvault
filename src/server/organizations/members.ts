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
