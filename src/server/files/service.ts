import { randomUUID } from "node:crypto";
import { Prisma, type FileVersion, type ProjectFile } from "@/generated/prisma/client";
import { assertSafeFilename, InvalidFilenameError } from "@/lib/schemas";
import type { UploadFileVersionRequest } from "@/lib/schemas";
import { db } from "../db";
import { assertCanAddFileVersion } from "../billing/entitlements";
import { ApiError } from "../http";
import { deleteObject, getObject, putObject } from "../storage";

/**
 * Version-history entitlement for one operation. `unlimited` is true for Pro
 * personal projects and for every organization project; false caps the file
 * at FREE_LIMITS.maxVersionsPerFile. The caller (route handler) resolves this
 * from the project's scope + owner's Pro status.
 */
export interface HistoryEntitlement {
  unlimited: boolean;
}

function newStorageKey(projectId: string): string {
  // Server-generated and random — never derived from the user-supplied
  // filename, so path traversal is structurally impossible regardless of what
  // the client sends.
  return `projects/${projectId}/${randomUUID()}.bin`;
}

interface NewVersionData {
  storageKey: string;
  ivBase64: string;
  contentId: string;
  plaintextSize: number;
  plaintextFingerprint: string;
  createdBySessionId: string;
}

/**
 * Appends a new version to a file and points `currentVersionId` at it.
 *
 * No interactive transaction: those require a session held across statements,
 * which a transaction-mode connection pooler (Neon, Supabase, PgBouncer)
 * does not provide. Instead the `@@unique([fileId, versionNumber])` constraint
 * is the concurrency guard — a racing writer that grabs the same number gets
 * a P2002 and we recompute and retry.
 */
async function appendVersion(fileId: string, data: NewVersionData): Promise<FileVersion> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const last = await db.fileVersion.findFirst({
      where: { fileId },
      orderBy: { versionNumber: "desc" },
      select: { versionNumber: true },
    });
    const versionNumber = (last?.versionNumber ?? 0) + 1;
    try {
      const version = await db.fileVersion.create({ data: { fileId, versionNumber, ...data } });
      await db.projectFile.update({
        where: { id: fileId },
        data: { currentVersionId: version.id, versionsCreated: { increment: 1 } },
      });
      return version;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002" &&
        attempt < 3
      ) {
        continue;
      }
      throw err;
    }
  }
  throw new ApiError(409, "Concurrent update to this file, please retry");
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

export function listVersions(fileId: string, limit?: number) {
  return db.fileVersion.findMany({
    where: { fileId },
    orderBy: { versionNumber: "desc" },
    ...(limit != null ? { take: limit } : {}),
  });
}

export async function uploadVersion(
  projectId: string,
  dto: UploadFileVersionRequest,
  sessionId: string,
  history: HistoryEntitlement,
) {
  let filename: string;
  try {
    filename = assertSafeFilename(dto.filename);
  } catch (err) {
    if (err instanceof InvalidFilenameError) throw new ApiError(400, err.message);
    throw err;
  }

  // Enforce the free-tier history cap before writing any bytes.
  const priorFile = await db.projectFile.findUnique({
    where: { projectId_filename: { projectId, filename } },
    select: { versionsCreated: true },
  });
  assertCanAddFileVersion(priorFile?.versionsCreated ?? 0, history.unlimited);

  const ciphertext = Buffer.from(dto.payload.ciphertext, "base64");
  const storageKey = newStorageKey(projectId);
  await putObject(storageKey, ciphertext);

  try {
    const file = await db.projectFile.upsert({
      where: { projectId_filename: { projectId, filename } },
      create: { projectId, filename },
      update: {},
    });
    const version = await appendVersion(file.id, {
      storageKey,
      ivBase64: dto.payload.iv,
      contentId: dto.contentId,
      plaintextSize: dto.plaintextSize,
      plaintextFingerprint: dto.plaintextFingerprint,
      createdBySessionId: sessionId,
    });
    return { file, version };
  } catch (err) {
    await deleteObject(storageKey).catch(() => {});
    throw err;
  }
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
  history: HistoryEntitlement,
) {
  // A restore mints a brand-new version, so it is subject to the same cap.
  const file = await db.projectFile.findUniqueOrThrow({
    where: { id: fileId },
    select: { versionsCreated: true },
  });
  assertCanAddFileVersion(file.versionsCreated, history.unlimited);

  const target = await getVersionOwned(fileId, versionId);
  const bytes = await getObject(target.storageKey);
  const storageKey = newStorageKey(projectId);
  await putObject(storageKey, bytes);

  try {
    return await appendVersion(fileId, {
      storageKey,
      ivBase64: target.ivBase64,
      contentId: target.contentId,
      plaintextSize: target.plaintextSize,
      plaintextFingerprint: target.plaintextFingerprint,
      createdBySessionId: sessionId,
    });
  } catch (err) {
    await deleteObject(storageKey).catch(() => {});
    throw err;
  }
}

export async function deleteFile(fileId: string): Promise<void> {
  const versions = await db.fileVersion.findMany({
    where: { fileId },
    select: { storageKey: true },
  });
  // Break the file -> currentVersion FK first so the cascade delete of
  // versions has nothing pointing back at it, then delete the file (versions
  // cascade). No interactive transaction (pooler-incompatible).
  await db.projectFile.update({ where: { id: fileId }, data: { currentVersionId: null } });
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
      plaintextFingerprint: file.currentVersion.plaintextFingerprint,
    });
  }
  return results;
}
