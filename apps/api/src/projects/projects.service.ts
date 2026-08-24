import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type Project } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateProjectRequest } from "@envvault/types";
import { normalizeGitRemote } from "./normalize-git-remote";

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateProjectRequest): Promise<Project> {
    const existing = await this.prisma.project.findUnique({
      where: { ownerId_name: { ownerId, name: dto.name } },
    });
    if (existing) throw new ConflictException("A project with this name already exists");

    try {
      return await this.prisma.project.create({
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
      // Vanishingly unlikely UUIDv4 collision on the client-generated id.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("Project id already in use, please retry");
      }
      throw err;
    }
  }

  async listForOwner(ownerId: string) {
    return this.prisma.project.findMany({
      where: { ownerId },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { files: true } } },
    });
  }

  /** Throws 404 (not 403) on mismatched ownership so a project's existence cannot be probed. */
  async getOwned(ownerId: string, projectId: string): Promise<Project> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.ownerId !== ownerId) {
      throw new NotFoundException("Project not found");
    }
    return project;
  }

  async findByGitRemote(ownerId: string, gitRemoteUrl: string): Promise<Project | null> {
    const normalized = normalizeGitRemote(gitRemoteUrl);
    if (!normalized) return null;
    return this.prisma.project.findFirst({ where: { ownerId, gitRemoteUrl: normalized } });
  }

  async rename(ownerId: string, projectId: string, name: string): Promise<Project> {
    await this.getOwned(ownerId, projectId);
    const conflict = await this.prisma.project.findUnique({
      where: { ownerId_name: { ownerId, name } },
    });
    if (conflict && conflict.id !== projectId) {
      throw new ConflictException("A project with this name already exists");
    }
    return this.prisma.project.update({ where: { id: projectId }, data: { name } });
  }

  async delete(ownerId: string, projectId: string): Promise<void> {
    await this.getOwned(ownerId, projectId);
    await this.prisma.project.delete({ where: { id: projectId } });
  }

  assertOwnership(project: Project, ownerId: string): void {
    if (project.ownerId !== ownerId) throw new ForbiddenException();
  }
}
