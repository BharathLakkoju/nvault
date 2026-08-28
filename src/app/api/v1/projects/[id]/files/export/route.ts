import { audit } from "@/server/audit";
import { requireAuth } from "@/server/auth/require-auth";
import { handler, json } from "@/server/http";
import { exportProjectFiles } from "@/server/files/service";
import { getOwnedProject } from "@/server/projects/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (req, { params }) => {
  const auth = await requireAuth(req);
  const project = await getOwnedProject(auth.userId, params.id);
  const files = await exportProjectFiles(params.id);
  await audit({
    userId: auth.userId,
    action: "file.downloaded",
    targetType: "project",
    targetId: params.id,
    metadata: { bulk: true, fileCount: files.length },
  });
  return json({
    project: {
      id: project.id,
      name: project.name,
      wrappedProjectKey: {
        iv: project.wrappedProjectKeyIv,
        ciphertext: project.wrappedProjectKeyCiphertext,
      },
    },
    files,
  });
});
