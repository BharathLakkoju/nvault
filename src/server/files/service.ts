import type { ProjectFile } from "@prisma/client";
import { assertSafeFilename, InvalidFilenameError } from "@/lib/schemas";
import type { UploadFileVersionRequest } from "@/lib/schemas";
import { db } from "../db";
import { ApiError } from "../http";
import { deleteObject, getObject, putObject } from "../storage";

function storageKeyFor(projectId: string, fileId: string, versionNumber: number): string {
  // Always derived from server-generated cuids, never from the user-supplied
  // filename — this is what makes path traversal structurally impossible
  // regardless of what filename the client sends.
  return `projects/${projectId}/files/${fileId}/v${versionNumber}.bin`;
}

export function listFiles(projectId: string) {
  return db.projectFile.findMany({
    where: { projectId },
    orderBy: { filename: "asc" },
    include: { currentVersion: true },
  });
}

export async function getFileOwned(projectId: string, fileId: string): Promise<ProjectFile> {
  const file = await db.projectFile.findUnique({ where: { id: fileId } });
  if (!file || file.projectId !== projectId) throw new ApiError(404, "File not found");
  return file;
}

export function listVersions(fileId: string) {
  return db.fileVersion.findMany({
    where: { fileId },
    orderBy: { versionNumber: "desc" },
  });
}

export async function uploadVersion(
  projectId: string,
  dto: UploadFileVersionRequest,
  sessionId: string,
) {
  let filename: string;
  try {
    filename = assertSafeFilename(dto.filename);
  } catch (err) {
    if (err instanceof InvalidFilenameError) throw new ApiError(400, err.message);
    throw err;
  }
  const ciphertext = Buffer.from(dto.payload.ciphertext, "base64");

  return db.$transaction(async (tx) => {
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

    await putObject(storageKey, ciphertext);

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

export async function getVersionOwned(fileId: string, versionId: string) {
  const version = await db.fileVersion.findUnique({ where: { id: versionId } });
  if (!version || version.fileId !== fileId) throw new ApiError(404, "Version not found");
  return version;
}

export async function readVersionPayload(storageKey: string, ivBase64: string, contentId: string) {
  const ciphertext = await getObject(storageKey);
  return { iv: ivBase64, ciphertext: ciphertext.toString("base64"), contentId };
}

/**
 * Restores an old version by copying its (still-encrypted) bytes into a
 * brand-new version record — non-destructive, like a git revert. Each
 * FileVersion row exclusively owns one storage blob, which keeps deletion
 * logic simple and safe.
 */
export async function restoreVersion(
  projectId: string,
  fileId: string,
  versionId: string,
  sessionId: string,
) {
  const target = await getVersionOwned(fileId, versionId);
  const bytes = await getObject(target.storageKey);

  return db.$transaction(async (tx) => {
    const last = await tx.fileVersion.findFirst({
      where: { fileId },
      orderBy: { versionNumber: "desc" },
    });
    const versionNumber = (last?.versionNumber ?? 0) + 1;
    const storageKey = storageKeyFor(projectId, fileId, versionNumber);
    await putObject(storageKey, bytes);

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

export async function deleteFile(fileId: string): Promise<void> {
  const versions = await db.fileVersion.findMany({ where: { fileId } });
  await db.projectFile.delete({ where: { id: fileId } });
  await Promise.allSettled(versions.map((v) => deleteObject(v.storageKey)));
}

export async function exportProjectFiles(projectId: string) {
  const files = await db.projectFile.findMany({
    where: { projectId, currentVersionId: { not: null } },
    include: { currentVersion: true },
  });
  const results = [];
  for (const file of files) {
    if (!file.currentVersion) continue;
    const payload = await readVersionPayload(
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
