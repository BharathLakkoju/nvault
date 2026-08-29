import { audit } from "@/server/audit";
import { requireAuth } from "@/server/auth/require-auth";
import { authorizeProject } from "@/server/authz/project-access";
import { clientIp, handler, noContent } from "@/server/http";
import { deleteFile, getFileOwned } from "@/server/files/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const DELETE = handler(async (req, { params }) => {
  const auth = await requireAuth(req);
  const { project } = await authorizeProject(auth.userId, params.id, "write");
  const file = await getFileOwned(params.id, params.fileId);
  await deleteFile(file.id);
  await audit({
    userId: auth.userId,
    organizationId: project.organizationId,
    action: "file.deleted",
    targetType: "file",
    targetId: file.id,
    metadata: { filename: file.filename },
    ipAddress: clientIp(req),
  });
  return noContent();
});
