import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { ProjectFile } from "@prisma/client";
import { assertSafeFilename, InvalidFilenameError } from "@envvault/types";
import type { UploadFileVersionRequest } from "@envvault/types";
import { PrismaService } from "../prisma/prisma.service";
import { STORAGE_PROVIDER, type StorageProvider } from "../storage/storage-provider.interface";

function storageKeyFor(projectId: string, fileId: string, versionNumber: number): string {
  // Always derived from server-generated cuids, never from the user-supplied
  // filename — this is what makes path traversal / zip-slip structurally
  // impossible regardless of what filename the client sends.
  return `projects/${projectId}/files/${fileId}/v${versionNumber}.bin`;
}

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  async listFiles(projectId: string) {
    return this.prisma.projectFile.findMany({
      where: { projectId },
      orderBy: { filename: "asc" },
      include: { currentVersion: true },
    });
  }

  async getFileOwned(projectId: string, fileId: string): Promise<ProjectFile> {
    const file = await this.prisma.projectFile.findUnique({ where: { id: fileId } });
    if (!file || file.projectId !== projectId) throw new NotFoundException("File not found");
    return file;
  }

  async listVersions(fileId: string) {
    return this.prisma.fileVersion.findMany({
      where: { fileId },
      orderBy: { versionNumber: "desc" },
    });
  }

  async uploadVersion(
    projectId: string,
    dto: UploadFileVersionRequest,
    sessionId: string,
  ) {
    let filename: string;
    try {
      filename = assertSafeFilename(dto.filename);
    } catch (err) {
      if (err instanceof InvalidFilenameError) throw new BadRequestException(err.message);
      throw err;
    }
    const ciphertext = Buffer.from(dto.payload.ciphertext, "base64");

    return this.prisma.$transaction(async (tx) => {
      const file = await tx.projectFile.upsert({
        where: { projectId_filename: { projectId, filename } },
        create: { projectId, filename },
        update: {},
      });

      const last = await tx.fileVersion.findFirst({
        where: { fileId: file.id },
        orderBy: { versionNumber: "desc" },
      });
      const versionNumber = (last?.versionNumber ?? 0) + 1;
      const storageKey = storageKeyFor(projectId, file.id, versionNumber);

      await this.storage.putObject(storageKey, ciphertext);

      const version = await tx.fileVersion.create({
        data: {
          fileId: file.id,
          versionNumber,
          storageKey,
          ivBase64: dto.payload.iv,
          contentId: dto.contentId,
          plaintextSize: dto.plaintextSize,
          plaintextSha256: dto.plaintextSha256,
          createdBySessionId: sessionId,
        },
      });

      await tx.projectFile.update({
        where: { id: file.id },
        data: { currentVersionId: version.id },
      });

      return { file, version };
    });
  }

  async getVersionOwned(fileId: string, versionId: string) {
    const version = await this.prisma.fileVersion.findUnique({ where: { id: versionId } });
    if (!version || version.fileId !== fileId) throw new NotFoundException("Version not found");
    return version;
  }

  async readVersionPayload(storageKey: string, ivBase64: string, contentId: string) {
    const ciphertext = await this.storage.getObject(storageKey);
    return { iv: ivBase64, ciphertext: ciphertext.toString("base64"), contentId };
  }

  /**
   * Restores an old version by copying its (still-encrypted) bytes into a
   * brand-new version record — non-destructive, like a git revert. Each
   * FileVersion row exclusively owns one storage blob, which keeps deletion
   * logic simple and safe.
   */
  async restoreVersion(projectId: string, fileId: string, versionId: string, sessionId: string) {
    const target = await this.getVersionOwned(fileId, versionId);
    const bytes = await this.storage.getObject(target.storageKey);

    return this.prisma.$transaction(async (tx) => {
      const last = await tx.fileVersion.findFirst({
        where: { fileId },
        orderBy: { versionNumber: "desc" },
      });
      const versionNumber = (last?.versionNumber ?? 0) + 1;
      const storageKey = storageKeyFor(projectId, fileId, versionNumber);
      await this.storage.putObject(storageKey, bytes);

      const version = await tx.fileVersion.create({
        data: {
          fileId,
          versionNumber,
          storageKey,
          ivBase64: target.ivBase64,
          contentId: target.contentId,
          plaintextSize: target.plaintextSize,
          plaintextSha256: target.plaintextSha256,
          createdBySessionId: sessionId,
        },
      });
      await tx.projectFile.update({ where: { id: fileId }, data: { currentVersionId: version.id } });
      return version;
    });
  }

  async deleteFile(fileId: string): Promise<void> {
    const versions = await this.prisma.fileVersion.findMany({ where: { fileId } });
    await this.prisma.projectFile.delete({ where: { id: fileId } });
    await Promise.allSettled(versions.map((v) => this.storage.deleteObject(v.storageKey)));
  }

  async exportProjectFiles(projectId: string) {
    const files = await this.prisma.projectFile.findMany({
      where: { projectId, currentVersionId: { not: null } },
      include: { currentVersion: true },
    });
    const results = [];
    for (const file of files) {
      if (!file.currentVersion) continue;
      const payload = await this.readVersionPayload(
        file.currentVersion.storageKey,
        file.currentVersion.ivBase64,
        file.currentVersion.contentId,
      );
      results.push({
        filename: file.filename,
        payload,
        plaintextSize: file.currentVersion.plaintextSize,
        plaintextSha256: file.currentVersion.plaintextSha256,
      });
    }
    return results;
  }
}
