import { RestoreVersionRequestSchema } from "@/lib/schemas";
import { audit } from "@/server/audit";
import { requireAuth } from "@/server/auth/require-auth";
import { handler, json, readJson } from "@/server/http";
import { getFileOwned, restoreVersion } from "@/server/files/service";
import { getOwnedProject } from "@/server/projects/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req, { params }) => {
  const auth = await requireAuth(req);
  await getOwnedProject(auth.userId, params.id);
  const file = await getFileOwned(params.id, params.fileId);
  const dto = await readJson(req, RestoreVersionRequestSchema);
  const version = await restoreVersion(params.id, file.id, dto.versionId, auth.sessionId);
  await audit({
    userId: auth.userId,
    action: "file.version_restored",
    targetType: "file",
    targetId: file.id,
    metadata: { filename: file.filename, restoredAsVersion: version.versionNumber },
  });
  return json(
    {
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
