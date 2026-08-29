import type { OrganizationMembership } from "@/generated/prisma/client";
import type { RotateKeyRequest } from "@/lib/schemas";
import { db } from "../db";
import { ApiError } from "../http";

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((x) => set.has(x));
}

/**
 * Rotates the Organization Key. Called after a member is removed so the
 * departed member's copy of the old key can no longer decrypt blobs they
 * re-download.
 *
 * The client generates a fresh Org Key, re-wraps every org project key and
 * every ACTIVE member's Org Key under it, and submits the whole set here.
 * The server enforces that the submission covers *exactly* the current
 * project set and the current ACTIVE membership set (no more, no less), then
 * applies it. `currentKeyEpoch` is bumped LAST: a mid-way failure leaves
 * clients still seeing the old epoch as current, which is the safe state.
 *
 * No interactive transaction (transaction-mode pooler). INVITED members are
 * untouched — they hold no key and will be granted the new epoch's key when
 * an admin confirms them.
 */
export async function rotateKey(
  orgId: string,
  actor: OrganizationMembership,
  input: RotateKeyRequest,
): Promise<{ epoch: number }> {
  if (actor.status !== "ACTIVE") {
    throw new ApiError(403, "You need organization key access to rotate the key.");
  }

  const org = await db.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: { currentKeyEpoch: true },
  });
  if (input.newEpoch !== org.currentKeyEpoch + 1) {
    throw new ApiError(409, "The organization key changed. Reload and retry the rotation.");
  }

  const projects = await db.project.findMany({
    where: { organizationId: orgId },
    select: { id: true },
  });
  if (!sameSet(projects.map((p) => p.id), input.projectKeys.map((p) => p.projectId))) {
    throw new ApiError(400, "The rotation must re-wrap exactly the organization's current projects.");
  }

  const activeMembers = await db.organizationMembership.findMany({
    where: { organizationId: orgId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!sameSet(activeMembers.map((m) => m.id), input.memberKeys.map((m) => m.membershipId))) {
    throw new ApiError(
      400,
      "The rotation must re-wrap the Org Key for exactly the current active members.",
    );
  }

  await db.organizationKeyEpoch.create({
    data: { organizationId: orgId, epoch: input.newEpoch, rotatedById: actor.userId },
  });

  for (const m of input.memberKeys) {
    await db.organizationMembership.update({
      where: { id: m.membershipId },
      data: { wrappedOrgKeyCiphertext: m.wrappedOrgKey, keyEpoch: input.newEpoch },
    });
  }
  for (const p of input.projectKeys) {
    await db.project.update({
      where: { id: p.projectId },
      data: {
        wrappedProjectKeyIv: p.wrappedProjectKey.iv,
        wrappedProjectKeyCiphertext: p.wrappedProjectKey.ciphertext,
        keyEpoch: input.newEpoch,
      },
    });
  }
  await db.organization.update({
    where: { id: orgId },
    data: { currentKeyEpoch: input.newEpoch },
  });

  return { epoch: input.newEpoch };
}
