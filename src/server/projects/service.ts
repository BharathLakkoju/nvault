import { Prisma, type Project } from "@prisma/client";
import type { CreateProjectRequest } from "@/lib/schemas";
import { db } from "../db";
import { ApiError } from "../http";
import { normalizeGitRemote } from "./normalize-git-remote";

export async function createProject(ownerId: string, dto: CreateProjectRequest): Promise<Project> {
  const existing = await db.project.findUnique({
    where: { ownerId_name: { ownerId, name: dto.name } },
  });
  if (existing) throw new ApiError(409, "A project with this name already exists");

  try {
    return await db.project.create({
      data: {
        id: dto.id,
        ownerId,
        name: dto.name,
        gitRemoteUrl: normalizeGitRemote(dto.gitRemoteUrl),
        wrappedProjectKeyIv: dto.wrappedProjectKey.iv,
        wrappedProjectKeyCiphertext: dto.wrappedProjectKey.ciphertext,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ApiError(409, "Project id already in use, please retry");
    }
    throw err;
  }
}

export function listProjectsForOwner(ownerId: string) {
  return db.project.findMany({
    where: { ownerId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { files: true } } },
  });
}

/** Throws 404 (not 403) on mismatched ownership so a project's existence cannot be probed. */
export async function getOwnedProject(ownerId: string, projectId: string): Promise<Project> {
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project || project.ownerId !== ownerId) {
    throw new ApiError(404, "Project not found");
  }
  return project;
}

export async function findProjectByGitRemote(
  ownerId: string,
  gitRemoteUrl: string,
): Promise<Project | null> {
  const normalized = normalizeGitRemote(gitRemoteUrl);
  if (!normalized) return null;
  return db.project.findFirst({ where: { ownerId, gitRemoteUrl: normalized } });
}

export async function renameProject(
  ownerId: string,
  projectId: string,
  name: string,
): Promise<Project> {
  await getOwnedProject(ownerId, projectId);
  const conflict = await db.project.findUnique({ where: { ownerId_name: { ownerId, name } } });
  if (conflict && conflict.id !== projectId) {
    throw new ApiError(409, "A project with this name already exists");
  }
  return db.project.update({ where: { id: projectId }, data: { name } });
}

export async function deleteProject(ownerId: string, projectId: string): Promise<void> {
  await getOwnedProject(ownerId, projectId);
  await db.project.delete({ where: { id: projectId } });
  // The project's file/version rows cascade, but storage_objects has no FK
  // back to them — every blob for this project is keyed `projects/<id>/…`,
  // so one prefix delete cleans them all up.
  await db.storageObject
    .deleteMany({ where: { key: { startsWith: `projects/${projectId}/` } } })
    .catch(() => {});
}

export function projectToDto(project: {
  id: string;
  name: string;
  gitRemoteUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  wrappedProjectKeyIv: string;
  wrappedProjectKeyCiphertext: string;
}) {
  return {
    id: project.id,
    name: project.name,
    gitRemoteUrl: project.gitRemoteUrl,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    wrappedProjectKey: {
      iv: project.wrappedProjectKeyIv,
      ciphertext: project.wrappedProjectKeyCiphertext,
    },
  };
}
