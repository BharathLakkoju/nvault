import { RestoreVersionRequestSchema } from "@/lib/schemas";
import { audit } from "@/server/audit";
import { requireAuth } from "@/server/auth/require-auth";
import { authorizeProject } from "@/server/authz/project-access";
import { userHasActivePro } from "@/server/billing/service";
import { clientIp, handler, json, readJson } from "@/server/http";
import { getFileOwned, restoreVersion } from "@/server/files/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req, { params }) => {
  const auth = await requireAuth(req);
  const { project, scope } = await authorizeProject(auth.userId, params.id, "write");
  const file = await getFileOwned(params.id, params.fileId);
  const dto = await readJson(req, RestoreVersionRequestSchema);
  const unlimited = scope === "org" || (await userHasActivePro(project.ownerId));
  const version = await restoreVersion(params.id, file.id, dto.versionId, auth.sessionId, {
    unlimited,
  });
  await audit({
    userId: auth.userId,
    organizationId: project.organizationId,
    action: "file.version_restored",
    targetType: "file",
    targetId: file.id,
    metadata: { filename: file.filename, restoredAsVersion: version.versionNumber },
    ipAddress: clientIp(req),
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
