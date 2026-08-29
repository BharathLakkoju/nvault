import { requireAuth } from "@/server/auth/require-auth";
import { authorizeProject } from "@/server/authz/project-access";
import { handler, json } from "@/server/http";
import { getFileOwned, listVersions } from "@/server/files/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (req, { params }) => {
  const auth = await requireAuth(req);
  await authorizeProject(auth.userId, params.id, "read");
  const file = await getFileOwned(params.id, params.fileId);
  const versions = await listVersions(file.id);
  return json({
    versions: versions.map((v) => ({
      id: v.id,
      versionNumber: v.versionNumber,
      plaintextSize: v.plaintextSize,
      plaintextSha256: v.plaintextSha256,
      createdAt: v.createdAt,
      isCurrent: v.id === file.currentVersionId,
    })),
  });
});
