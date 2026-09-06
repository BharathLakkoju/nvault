import { requireAuth } from "@/server/auth/require-auth";
import { authorizeProject } from "@/server/authz/project-access";
import { userHasActivePro } from "@/server/billing/service";
import { FREE_LIMITS } from "@/server/billing/entitlements";
import { handler, json } from "@/server/http";
import { getFileOwned, listVersions } from "@/server/files/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (req, { params }) => {
  const auth = await requireAuth(req);
  const { project, scope } = await authorizeProject(auth.userId, params.id, "read");
  const file = await getFileOwned(params.id, params.fileId);

  // Free personal projects only ever expose the most recent N versions.
  const unlimited = scope === "org" || (await userHasActivePro(project.ownerId));
  const limit = unlimited ? undefined : FREE_LIMITS.maxVersionsPerFile;
  const versions = await listVersions(file.id, limit);

  return json({
    versions: versions.map((v) => ({
      id: v.id,
      versionNumber: v.versionNumber,
      plaintextSize: v.plaintextSize,
      plaintextFingerprint: v.plaintextFingerprint,
      createdAt: v.createdAt,
      isCurrent: v.id === file.currentVersionId,
    })),
    capped: !unlimited,
    limit: unlimited ? null : FREE_LIMITS.maxVersionsPerFile,
  });
});
