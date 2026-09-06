import { audit } from "@/server/audit";
import { requireAuth } from "@/server/auth/require-auth";
import { clientIp, handler, json } from "@/server/http";
import {
  getFileOwned,
  getVersionOwned,
  readVersionPayload,
} from "@/server/files/service";
import { authorizeProject } from "@/server/authz/project-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (req, { params }) => {
  const auth = await requireAuth(req);
  const { project } = await authorizeProject(auth.userId, params.id, "read");
  const file = await getFileOwned(params.id, params.fileId);
  const version = await getVersionOwned(file.id, params.versionId);
  const payload = await readVersionPayload(version.storageKey, version.ivBase64, version.contentId);
  await audit({
    userId: auth.userId,
    organizationId: project.organizationId,
    action: "file.downloaded",
    targetType: "file",
    targetId: file.id,
    metadata: { filename: file.filename, versionNumber: version.versionNumber },
    ipAddress: clientIp(req),
  });
  return json({
    filename: file.filename,
    payload,
    plaintextSize: version.plaintextSize,
    plaintextFingerprint: version.plaintextFingerprint,
  });
});
