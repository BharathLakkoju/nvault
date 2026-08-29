import type { OrgRole, Project } from "@prisma/client";
import { db } from "../db";
import { ApiError } from "../http";
import { roleAtLeast } from "./roles";

/**
 * What a request wants to do with a project:
 *   read   — list/download files and versions
 *   write  — upload a version, restore a version, delete a file
 *   manage — rename / delete / move the project itself
 */
export type ProjectAction = "read" | "write" | "manage";

export interface ProjectAccess {
  project: Project;
  scope: "personal" | "org";
  /** "owner" for a personal project; the caller's org role for an org project. */
  role: OrgRole | "owner";
  organizationId: string | null;
}

const MIN_ROLE_FOR_ACTION: Record<ProjectAction, OrgRole> = {
  read: "MEMBER",
  write: "MEMBER",
  manage: "ADMIN",
};

/**
 * The single authorization choke point for every project/file/version route.
 * Replaces the old `getOwnedProject(ownerId, id)` equality check.
 *
 * - Personal project (`organizationId == null`): the caller must be the owner.
 * - Org project: the caller must have an ACTIVE membership whose role meets
 *   the action's minimum (`manage` needs ADMIN or OWNER; read/write need any
 *   active member).
 *
 * Always throws 404 (not 403) on no-access so a project's existence — and an
 * org's — cannot be probed by id.
 */
export async function authorizeProject(
  userId: string,
  projectId: string,
  action: ProjectAction,
): Promise<ProjectAccess> {
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) throw new ApiError(404, "Project not found");

  if (!project.organizationId) {
    if (project.ownerId !== userId) throw new ApiError(404, "Project not found");
    return { project, scope: "personal", role: "owner", organizationId: null };
  }

  const membership = await db.organizationMembership.findUnique({
    where: {
      organizationId_userId: { organizationId: project.organizationId, userId },
    },
  });
  if (!membership || membership.status !== "ACTIVE") {
    throw new ApiError(404, "Project not found");
  }
  if (!roleAtLeast(membership.role, MIN_ROLE_FOR_ACTION[action])) {
    throw new ApiError(403, "You do not have permission to do that in this organization.");
  }
  return {
    project,
    scope: "org",
    role: membership.role,
    organizationId: project.organizationId,
  };
}
