import { CreateProjectRequestSchema } from "@/lib/schemas";
import { audit } from "@/server/audit";
import { requireAuth } from "@/server/auth/require-auth";
import { clientIp, handler, json, readJson } from "@/server/http";
import { createProject, listProjectsForUser, projectToDto } from "@/server/projects/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (req) => {
  const auth = await requireAuth(req);
  const projects = await listProjectsForUser(auth.userId);
  return json({
    projects: projects.map((p) => ({
      ...projectToDto(p, p.organization),
      fileCount: p._count.files,
    })),
  });
});

export const POST = handler(async (req) => {
  const auth = await requireAuth(req);
  const dto = await readJson(req, CreateProjectRequestSchema);
  const project = await createProject(auth.userId, dto);
  await audit({
    userId: auth.userId,
    organizationId: project.organizationId,
    action: "project.created",
    targetType: "project",
    targetId: project.id,
    metadata: { name: project.name, scope: project.organizationId ? "org" : "personal" },
    ipAddress: clientIp(req),
  });
  return json({ project: projectToDto(project) }, 201);
});
