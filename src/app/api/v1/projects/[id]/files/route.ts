import { MAX_FILE_SIZE_BYTES, UploadFileVersionRequestSchema } from "@/lib/schemas";
import { audit } from "@/server/audit";
import { requireAuth } from "@/server/auth/require-auth";
import { ApiError, clientIp, handler, json, readJson } from "@/server/http";
import { authorizeProject } from "@/server/authz/project-access";
import { userHasActivePro } from "@/server/billing/service";
import { listFiles, uploadVersion } from "@/server/files/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Ciphertext = plaintext + GCM tag; base64 adds ~33%. This ceiling also keeps
// every request under Vercel's fixed ~4.5MB serverless body limit.
const MAX_BODY_BYTES = Math.ceil((MAX_FILE_SIZE_BYTES + 4096) * 1.4);

export const GET = handler(async (req, { params }) => {
  const auth = await requireAuth(req);
  await authorizeProject(auth.userId, params.id, "read");
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

  const { project, scope } = await authorizeProject(auth.userId, params.id, "write");
  const dto = await readJson(req, UploadFileVersionRequestSchema);

  if (Buffer.byteLength(dto.payload.ciphertext, "base64") > MAX_FILE_SIZE_BYTES + 4096) {
    throw new ApiError(413, "File is too large. The maximum config file size is 2.5 MiB.");
  }

  // Org projects follow the org's Team subscription; personal projects follow
  // the owner's Pro status. Free personal projects are capped per file.
  const unlimited = scope === "org" || (await userHasActivePro(project.ownerId));
  const { file, version } = await uploadVersion(params.id, dto, auth.sessionId, { unlimited });
  await audit({
    userId: auth.userId,
    organizationId: project.organizationId,
    action: "file.uploaded",
    targetType: "file",
    targetId: file.id,
    metadata: { filename: file.filename, versionNumber: version.versionNumber },
    ipAddress: clientIp(req),
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
