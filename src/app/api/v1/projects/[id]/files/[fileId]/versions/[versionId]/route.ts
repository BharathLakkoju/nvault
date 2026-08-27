import { audit } from "@/server/audit";
import { requireAuth } from "@/server/auth/require-auth";
import { handler, json } from "@/server/http";
import {
  getFileOwned,
  getVersionOwned,
  readVersionPayload,
} from "@/server/files/service";
import { getOwnedProject } from "@/server/projects/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (req, { params }) => {
  const auth = await requireAuth(req);
  await getOwnedProject(auth.userId, params.id);
  const file = await getFileOwned(params.id, params.fileId);
  const version = await getVersionOwned(file.id, params.versionId);
  const payload = await readVersionPayload(version.storageKey, version.ivBase64, version.contentId);
  await audit({
    userId: auth.userId,
    action: "file.downloaded",
    targetType: "file",
    targetId: file.id,
    metadata: { filename: file.filename, versionNumber: version.versionNumber },
  });
  return json({
    filename: file.filename,
    payload,
    plaintextSize: version.plaintextSize,
    plaintextSha256: version.plaintextSha256,
  });
});
