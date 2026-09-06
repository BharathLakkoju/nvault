import type { OrganizationMembership } from "@/generated/prisma/client";
import type { RotateKeyRequest } from "@/lib/schemas";
import { db } from "../db";
import { ApiError } from "../http";
import { sameIdSet } from "./same-id-set";

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
 * The complete state transition runs in one database transaction. Deployments
 * must therefore use a session-capable Postgres endpoint for DATABASE_URL;
 * transaction-mode poolers cannot safely execute this operation.
 * INVITED members are untouched — they hold no key and will be granted the
 * new epoch's key when an admin confirms them.
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
  if (!sameIdSet(projects.map((p) => p.id), input.projectKeys.map((p) => p.projectId))) {
    throw new ApiError(400, "The rotation must re-wrap exactly the organization's current projects.");
  }

  const activeMembers = await db.organizationMembership.findMany({
    where: { organizationId: orgId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!sameIdSet(activeMembers.map((m) => m.id), input.memberKeys.map((m) => m.membershipId))) {
    throw new ApiError(
      400,
      "The rotation must re-wrap the Org Key for exactly the current active members.",
    );
  }

  await db.$transaction(async (tx) => {
    const current = await tx.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { currentKeyEpoch: true, rosterVersion: true },
    });
    if (
      current.currentKeyEpoch !== org.currentKeyEpoch ||
      current.rosterVersion !== input.expectedRosterVersion
    ) {
      throw new ApiError(409, "The membership changed mid-rotation. Reload and retry.");
    }

    for (const m of input.memberKeys) {
      await tx.organizationMembership.update({
        where: { id: m.membershipId },
        data: { wrappedOrgKeyCiphertext: m.wrappedOrgKey, keyEpoch: input.newEpoch },
      });
    }
    for (const p of input.projectKeys) {
      await tx.project.update({
        where: { id: p.projectId },
        data: {
          wrappedProjectKeyIv: p.wrappedProjectKey.iv,
          wrappedProjectKeyCiphertext: p.wrappedProjectKey.ciphertext,
          keyEpoch: input.newEpoch,
        },
      });
    }

    await tx.organization.update({
      where: { id: orgId },
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

    await tx.organizationKeyEpoch.upsert({
      where: { organizationId_epoch: { organizationId: orgId, epoch: input.newEpoch } },
      create: { organizationId: orgId, epoch: input.newEpoch, rotatedById: actor.userId },
      update: {},
    });
  });

  return { epoch: input.newEpoch };
}
