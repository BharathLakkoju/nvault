import { audit } from "@/server/audit";
import { requireAuth } from "@/server/auth/require-auth";
import { handler, noContent } from "@/server/http";
import { deleteFile, getFileOwned } from "@/server/files/service";
import { getOwnedProject } from "@/server/projects/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const DELETE = handler(async (req, { params }) => {
  const auth = await requireAuth(req);
  await getOwnedProject(auth.userId, params.id);
  const file = await getFileOwned(params.id, params.fileId);
  await deleteFile(file.id);
  await audit({
    userId: auth.userId,
    action: "file.deleted",
    targetType: "file",
    targetId: file.id,
    metadata: { filename: file.filename },
  });
  return noContent();
});
