import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { CreateProjectRequestSchema, RenameProjectRequestSchema } from "@envvault/types";
import type { CreateProjectRequest, RenameProjectRequest } from "@envvault/types";
import { CurrentAuth } from "../common/decorators/current-user.decorator";
import type { AuthContext } from "../common/request-context";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { ProjectsService } from "./projects.service";
import { AuditService } from "../audit/audit.service";

@Controller("projects")
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  async list(@CurrentAuth() auth: AuthContext) {
    const projects = await this.projectsService.listForOwner(auth.userId);
    return {
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        gitRemoteUrl: p.gitRemoteUrl,
        fileCount: p._count.files,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        wrappedProjectKey: { iv: p.wrappedProjectKeyIv, ciphertext: p.wrappedProjectKeyCiphertext },
      })),
    };
  }

  @Get("by-git-remote")
  async findByGitRemote(@CurrentAuth() auth: AuthContext, @Query("url") url: string) {
    const project = url ? await this.projectsService.findByGitRemote(auth.userId, url) : null;
    return { project: project ? this.toDto(project) : null };
  }

  @Post()
  async create(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(CreateProjectRequestSchema)) dto: CreateProjectRequest,
  ) {
    const project = await this.projectsService.create(auth.userId, dto);
    await this.auditService.log({
      userId: auth.userId,
      action: "project.created",
      targetType: "project",
      targetId: project.id,
      metadata: { name: project.name },
    });
    return { project: this.toDto(project) };
  }

  @Get(":id")
  async get(@CurrentAuth() auth: AuthContext, @Param("id") id: string) {
    const project = await this.projectsService.getOwned(auth.userId, id);
    return { project: this.toDto(project) };
  }

  @Patch(":id")
  async rename(
    @CurrentAuth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(RenameProjectRequestSchema)) dto: RenameProjectRequest,
  ) {
    const project = await this.projectsService.rename(auth.userId, id, dto.name);
    await this.auditService.log({
      userId: auth.userId,
      action: "project.renamed",
      targetType: "project",
      targetId: project.id,
      metadata: { name: project.name },
    });
    return { project: this.toDto(project) };
  }

  @Delete(":id")
  @HttpCode(204)
  async delete(@CurrentAuth() auth: AuthContext, @Param("id") id: string) {
    const project = await this.projectsService.getOwned(auth.userId, id);
    await this.projectsService.delete(auth.userId, id);
    await this.auditService.log({
      userId: auth.userId,
      action: "project.deleted",
      targetType: "project",
      targetId: id,
      metadata: { name: project.name },
    });
  }

  private toDto(project: {
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
      wrappedProjectKey: { iv: project.wrappedProjectKeyIv, ciphertext: project.wrappedProjectKeyCiphertext },
    };
  }
}
