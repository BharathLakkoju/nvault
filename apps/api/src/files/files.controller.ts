import { Body, Controller, Delete, Get, HttpCode, Param, Post } from "@nestjs/common";
import {
  RestoreVersionRequestSchema,
  UploadFileVersionRequestSchema,
} from "@envvault/types";
import type { RestoreVersionRequest, UploadFileVersionRequest } from "@envvault/types";
import { CurrentAuth } from "../common/decorators/current-user.decorator";
import type { AuthContext } from "../common/request-context";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { ProjectsService } from "../projects/projects.service";
import { AuditService } from "../audit/audit.service";
import { FilesService } from "./files.service";

@Controller("projects/:projectId/files")
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
    private readonly projectsService: ProjectsService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  async list(@CurrentAuth() auth: AuthContext, @Param("projectId") projectId: string) {
    await this.projectsService.getOwned(auth.userId, projectId);
    const files = await this.filesService.listFiles(projectId);
    return {
      files: files.map((f) => ({
        id: f.id,
        filename: f.filename,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
        currentVersion: f.currentVersion
          ? {
              id: f.currentVersion.id,
              versionNumber: f.currentVersion.versionNumber,
              plaintextSize: f.currentVersion.plaintextSize,
              plaintextSha256: f.currentVersion.plaintextSha256,
              createdAt: f.currentVersion.createdAt,
            }
          : null,
      })),
    };
  }

  @Get("export")
  async exportAll(@CurrentAuth() auth: AuthContext, @Param("projectId") projectId: string) {
    const project = await this.projectsService.getOwned(auth.userId, projectId);
    const files = await this.filesService.exportProjectFiles(projectId);
    await this.auditService.log({
      userId: auth.userId,
      action: "file.downloaded",
      targetType: "project",
      targetId: projectId,
      metadata: { bulk: true, fileCount: files.length },
    });
    return {
      project: {
        id: project.id,
        name: project.name,
        wrappedProjectKey: { iv: project.wrappedProjectKeyIv, ciphertext: project.wrappedProjectKeyCiphertext },
      },
      files,
    };
  }

  @Post()
  async upload(
    @CurrentAuth() auth: AuthContext,
    @Param("projectId") projectId: string,
    @Body(new ZodValidationPipe(UploadFileVersionRequestSchema)) dto: UploadFileVersionRequest,
  ) {
    await this.projectsService.getOwned(auth.userId, projectId);
    const { file, version } = await this.filesService.uploadVersion(projectId, dto, auth.sessionId);
    await this.auditService.log({
      userId: auth.userId,
      action: "file.uploaded",
      targetType: "file",
      targetId: file.id,
      metadata: { filename: file.filename, versionNumber: version.versionNumber },
    });
    return {
      file: { id: file.id, filename: file.filename },
      version: {
        id: version.id,
        versionNumber: version.versionNumber,
        plaintextSize: version.plaintextSize,
        plaintextSha256: version.plaintextSha256,
        createdAt: version.createdAt,
      },
    };
  }

  @Get(":fileId/versions")
  async listVersions(
    @CurrentAuth() auth: AuthContext,
    @Param("projectId") projectId: string,
    @Param("fileId") fileId: string,
  ) {
    await this.projectsService.getOwned(auth.userId, projectId);
    const file = await this.filesService.getFileOwned(projectId, fileId);
    const versions = await this.filesService.listVersions(file.id);
    return {
      versions: versions.map((v) => ({
        id: v.id,
        versionNumber: v.versionNumber,
        plaintextSize: v.plaintextSize,
        plaintextSha256: v.plaintextSha256,
        createdAt: v.createdAt,
        isCurrent: v.id === file.currentVersionId,
      })),
    };
  }

  @Get(":fileId/versions/:versionId")
  async downloadVersion(
    @CurrentAuth() auth: AuthContext,
    @Param("projectId") projectId: string,
    @Param("fileId") fileId: string,
    @Param("versionId") versionId: string,
  ) {
    await this.projectsService.getOwned(auth.userId, projectId);
    const file = await this.filesService.getFileOwned(projectId, fileId);
    const version = await this.filesService.getVersionOwned(file.id, versionId);
    const payload = await this.filesService.readVersionPayload(
      version.storageKey,
      version.ivBase64,
      version.contentId,
    );
    await this.auditService.log({
      userId: auth.userId,
      action: "file.downloaded",
      targetType: "file",
      targetId: file.id,
      metadata: { filename: file.filename, versionNumber: version.versionNumber },
    });
    return {
      filename: file.filename,
      payload,
      plaintextSize: version.plaintextSize,
      plaintextSha256: version.plaintextSha256,
    };
  }

  @Post(":fileId/restore")
  async restore(
    @CurrentAuth() auth: AuthContext,
    @Param("projectId") projectId: string,
    @Param("fileId") fileId: string,
    @Body(new ZodValidationPipe(RestoreVersionRequestSchema)) dto: RestoreVersionRequest,
  ) {
    await this.projectsService.getOwned(auth.userId, projectId);
    const file = await this.filesService.getFileOwned(projectId, fileId);
    const version = await this.filesService.restoreVersion(
      projectId,
      file.id,
      dto.versionId,
      auth.sessionId,
    );
    await this.auditService.log({
      userId: auth.userId,
      action: "file.version_restored",
      targetType: "file",
      targetId: file.id,
      metadata: { filename: file.filename, restoredAsVersion: version.versionNumber },
    });
    return {
      version: {
        id: version.id,
        versionNumber: version.versionNumber,
        plaintextSize: version.plaintextSize,
        plaintextSha256: version.plaintextSha256,
        createdAt: version.createdAt,
      },
    };
  }

  @Delete(":fileId")
  @HttpCode(204)
  async delete(
    @CurrentAuth() auth: AuthContext,
    @Param("projectId") projectId: string,
    @Param("fileId") fileId: string,
  ) {
    await this.projectsService.getOwned(auth.userId, projectId);
    const file = await this.filesService.getFileOwned(projectId, fileId);
    await this.filesService.deleteFile(file.id);
    await this.auditService.log({
      userId: auth.userId,
      action: "file.deleted",
      targetType: "file",
      targetId: file.id,
      metadata: { filename: file.filename },
    });
  }
}
