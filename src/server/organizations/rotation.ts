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
 * every ACTIVE member's Org Key under it, re-wraps it under a brand-new
 * Enrollment Secret, re-encrypts the roster under it, and submits the whole
 * set here. Before doing so the client verifies every ACTIVE member's public
 * key against the roster pin (a substituted key aborts the rotation
 * client-side). The server enforces that the submission covers *exactly* the
 * current project set and the current ACTIVE membership set (no more, no
 * less), then applies it. `currentKeyEpoch` is bumped LAST: a mid-way failure
 * leaves clients still seeing the old epoch as current, which is the safe
 * state.
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
    select: { currentKeyEpoch: true, rosterVersion: true },
  });
  if (input.newEpoch !== org.currentKeyEpoch + 1) {
    throw new ApiError(409, "The organization key changed. Reload and retry the rotation.");
  }
  if (input.expectedRosterVersion !== org.rosterVersion) {
    throw new ApiError(409, "The membership changed. Reload and retry the rotation.");
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

  // Re-wrap member and project keys to the new epoch first. These are
  // idempotent on a retry (they write fixed values) and stay invisible while
  // `currentKeyEpoch` still points at the old epoch.
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

  // Commit point: roster + Enrollment Secret + epoch move together, guarded on
  // the roster version so a concurrent enrollment (which bumps it) aborts the
  // rotation rather than being silently overwritten.
  const bumped = await db.organization.updateMany({
    where: { id: orgId, rosterVersion: input.expectedRosterVersion },
    data: {
      currentKeyEpoch: input.newEpoch,
      enrollmentKdfSalt: input.enrollment.kdfSalt,
      enrollmentKdfIterations: input.enrollment.kdfIterations,
      enrollmentWrappedOrgKeyIv: input.enrollment.wrappedOrgKey.iv,
      enrollmentWrappedOrgKeyCiphertext: input.enrollment.wrappedOrgKey.ciphertext,
      enrollmentKeyEpoch: input.newEpoch,
      rosterIv: input.roster.iv,
      rosterCiphertext: input.roster.ciphertext,
      rosterVersion: input.expectedRosterVersion + 1,
    },
  });
  if (bumped.count === 0) {
    throw new ApiError(409, "The membership changed mid-rotation. Reload and retry.");
  }

  // History row last: only a fully-applied rotation is recorded. `upsert`
  // keeps a retried rotation (same newEpoch after a mid-way failure) from
  // tripping the (organizationId, epoch) unique constraint.
  await db.organizationKeyEpoch.upsert({
    where: { organizationId_epoch: { organizationId: orgId, epoch: input.newEpoch } },
    create: { organizationId: orgId, epoch: input.newEpoch, rotatedById: actor.userId },
    update: {},
  });

  return { epoch: input.newEpoch };
}
