import { MAX_FILE_SIZE_BYTES, UploadFileVersionRequestSchema } from "@/lib/schemas";
import { audit } from "@/server/audit";
import { requireAuth } from "@/server/auth/require-auth";
import { ApiError, handler, json, readJson } from "@/server/http";
import { listFiles, uploadVersion } from "@/server/files/service";
import { getOwnedProject } from "@/server/projects/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Ciphertext = plaintext + GCM tag; base64 adds ~33%. This ceiling also keeps
// every request under Vercel's fixed ~4.5MB serverless body limit.
const MAX_BODY_BYTES = Math.ceil((MAX_FILE_SIZE_BYTES + 4096) * 1.4);

export const GET = handler(async (req, { params }) => {
  const auth = await requireAuth(req);
  await getOwnedProject(auth.userId, params.id);
  const files = await listFiles(params.id);
  return json({
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
  });
});

export const POST = handler(async (req, { params }) => {
  const auth = await requireAuth(req);

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    throw new ApiError(413, "File is too large. The maximum config file size is 2.5 MiB.");
  }

  await getOwnedProject(auth.userId, params.id);
  const dto = await readJson(req, UploadFileVersionRequestSchema);

  if (Buffer.byteLength(dto.payload.ciphertext, "base64") > MAX_FILE_SIZE_BYTES + 4096) {
    throw new ApiError(413, "File is too large. The maximum config file size is 2.5 MiB.");
  }

  const { file, version } = await uploadVersion(params.id, dto, auth.sessionId);
  await audit({
    userId: auth.userId,
    action: "file.uploaded",
    targetType: "file",
    targetId: file.id,
    metadata: { filename: file.filename, versionNumber: version.versionNumber },
  });
  return json(
    {
      file: { id: file.id, filename: file.filename },
      version: {
        id: version.id,
        versionNumber: version.versionNumber,
        plaintextSize: version.plaintextSize,
        plaintextSha256: version.plaintextSha256,
        createdAt: version.createdAt,
      },
    },
    201,
  );
});
