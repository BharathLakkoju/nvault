import { Prisma, type Project } from "@/generated/prisma/client";
import type { CreateProjectRequest } from "@/lib/schemas";
import { db } from "../db";
import { authorizeOrg } from "../authz/org-access";
import { assertCanCreateOrgProject, assertCanCreatePersonalProject } from "../billing/entitlements";
import { userHasActivePro } from "../billing/service";
import { ApiError } from "../http";
import { normalizeGitRemote } from "./normalize-git-remote";

/**
 * Creates a project. When `dto.organizationId` is set the caller must be an
 * ADMIN or OWNER of that org, and the project key the client sends is
 * expected to be wrapped under the Organization Key at the org's current
 * epoch (the server stores it as opaque ciphertext and records the epoch).
 */
export async function createProject(ownerId: string, dto: CreateProjectRequest): Promise<Project> {
  let organizationId: string | null = null;
  let keyEpoch = 0;

  if (dto.organizationId) {
    // authorizeOrg enforces the billing gate — a PENDING_PAYMENT or SUSPENDED
    // org throws 402 here before any project is created.
    const membership = await authorizeOrg(ownerId, dto.organizationId, "ADMIN");
    organizationId = dto.organizationId;
    const org = await db.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { currentKeyEpoch: true },
    });
    keyEpoch = org.currentKeyEpoch;
    void membership;

    const orgProjectCount = await db.project.count({ where: { organizationId } });
    assertCanCreateOrgProject(orgProjectCount);
  } else {
    const [personalCount, hasPro] = await Promise.all([
      db.project.count({ where: { ownerId, organizationId: null } }),
      userHasActivePro(ownerId),
    ]);
    assertCanCreatePersonalProject(personalCount, hasPro);
  }

  const existing = organizationId
    ? await db.project.findFirst({ where: { organizationId, name: dto.name } })
    : await db.project.findFirst({ where: { ownerId, organizationId: null, name: dto.name } });
  if (existing) throw new ApiError(409, "A project with this name already exists");

  try {
    return await db.project.create({
      data: {
        id: dto.id,
        ownerId,
        organizationId,
        keyEpoch,
        name: dto.name,
        gitRemoteUrl: normalizeGitRemote(dto.gitRemoteUrl),
        wrappedProjectKeyIv: dto.wrappedProjectKey.iv,
        wrappedProjectKeyCiphertext: dto.wrappedProjectKey.ciphertext,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      if (err.meta && String(err.meta.target ?? "").includes("name")) {
        throw new ApiError(409, "A project with this name already exists");
      }
      throw new ApiError(409, "Project id already in use, please retry");
    }
    throw err;
  }
}

/**
 * Every project the user can see: their personal projects, plus the projects
 * of every org where they hold an ACTIVE membership.
 */
export function listProjectsForUser(userId: string) {
  return db.project.findMany({
    where: {
      OR: [
        { ownerId: userId, organizationId: null },
        {
          organization: {
            status: { in: ["ACTIVE", "SUSPENDED"] },
            memberships: { some: { userId, status: "ACTIVE" } },
          },
        },
      ],
    },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { files: true } },
      organization: { select: { id: true, name: true, slug: true } },
    },
  });
}

export async function findProjectByGitRemote(userId: string, gitRemoteUrl: string) {
  const normalized = normalizeGitRemote(gitRemoteUrl);
  if (!normalized) return null;
  return db.project.findFirst({
    where: {
      gitRemoteUrl: normalized,
      OR: [
        { ownerId: userId, organizationId: null },
        {
          organization: {
            status: { in: ["ACTIVE", "SUSPENDED"] },
            memberships: { some: { userId, status: "ACTIVE" } },
          },
        },
      ],
    },
    include: { organization: { select: { id: true, name: true, slug: true } } },
  });
}

/** Renames an already-authorized project, enforcing name uniqueness in its namespace. */
export async function renameProject(project: Project, name: string): Promise<Project> {
  return updateProject(project.ownerId, project, { name });
}

/** Updates mutable project fields (name, linked git remote). */
export async function updateProject(
  userId: string,
  project: Project,
  dto: { name?: string; gitRemoteUrl?: string | null },
): Promise<Project> {
  const data: { name?: string; gitRemoteUrl?: string | null } = {};

  if (dto.name !== undefined && dto.name !== project.name) {
    const conflict = project.organizationId
      ? await db.project.findFirst({
          where: { organizationId: project.organizationId, name: dto.name, id: { not: project.id } },
        })
      : await db.project.findFirst({
          where: { ownerId: project.ownerId, organizationId: null, name: dto.name, id: { not: project.id } },
        });
    if (conflict) throw new ApiError(409, "A project with this name already exists");
    data.name = dto.name;
  }

  if (dto.gitRemoteUrl !== undefined) {
    const normalized =
      dto.gitRemoteUrl === null || dto.gitRemoteUrl.trim() === ""
        ? null
        : (normalizeGitRemote(dto.gitRemoteUrl) ?? null);
    if (normalized !== project.gitRemoteUrl) {
      if (normalized) {
        const existing = await findProjectByGitRemote(userId, normalized);
        if (existing && existing.id !== project.id) {
          throw new ApiError(409, "Another project is already linked to this repository");
        }
      }
      data.gitRemoteUrl = normalized;
    }
  }

  if (Object.keys(data).length === 0) return project;
  return db.project.update({ where: { id: project.id }, data });
}

export async function deleteProject(projectId: string): Promise<void> {
  await db.project.delete({ where: { id: projectId } });
  // storage_objects has no FK back to file/version rows — every blob for this
  // project is keyed `projects/<id>/…`, so one prefix delete cleans them all.
  await db.storageObject
    .deleteMany({ where: { key: { startsWith: `projects/${projectId}/` } } })
    .catch(() => {});
}

export function projectToDto(
  project: {
    id: string;
    name: string;
    gitRemoteUrl: string | null;
    keyEpoch: number;
    organizationId: string | null;
    createdAt: Date;
    updatedAt: Date;
    wrappedProjectKeyIv: string;
    wrappedProjectKeyCiphertext: string;
  },
  organization?: { id: string; name: string; slug: string } | null,
) {
  return {
    id: project.id,
    name: project.name,
    gitRemoteUrl: project.gitRemoteUrl,
    scope: project.organizationId ? ("org" as const) : ("personal" as const),
    organizationId: project.organizationId,
    organizationName: organization?.name ?? null,
    organizationSlug: organization?.slug ?? null,
    keyEpoch: project.keyEpoch,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    wrappedProjectKey: {
      iv: project.wrappedProjectKeyIv,
      ciphertext: project.wrappedProjectKeyCiphertext,
    },
  };
}
