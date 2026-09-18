import { audit } from "@/server/audit";
import { requireAuth } from "@/server/auth/require-auth";
import { authorizeProject } from "@/server/authz/project-access";
import { clientIp, handler, json } from "@/server/http";
import { enforceRateLimit } from "@/server/ratelimit";
import { exportProjectFiles } from "@/server/files/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (req, { params }) => {
  const auth = await requireAuth(req);
  const ip = clientIp(req);
  await enforceRateLimit(`files/download:${auth.userId}`, { limit: 120, windowMs: 60_000 });
  await enforceRateLimit(`files/download:ip:${ip ?? "unknown"}`, { limit: 240, windowMs: 60_000 });
  const { project } = await authorizeProject(auth.userId, params.id, "read");
  const files = await exportProjectFiles(params.id);
  await audit({
    userId: auth.userId,
    organizationId: project.organizationId,
    action: "file.downloaded",
    targetType: "project",
    targetId: params.id,
    metadata: { bulk: true, fileCount: files.length },
    ipAddress: clientIp(req),
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
