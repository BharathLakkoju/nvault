import { CreateProjectRequestSchema } from "@/lib/schemas";
import { audit } from "@/server/audit";
import { requireAuth } from "@/server/auth/require-auth";
import { handler, json, readJson } from "@/server/http";
import { createProject, listProjectsForOwner, projectToDto } from "@/server/projects/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (req) => {
  const auth = await requireAuth(req);
  const projects = await listProjectsForOwner(auth.userId);
  return json({
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      gitRemoteUrl: p.gitRemoteUrl,
      fileCount: p._count.files,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      wrappedProjectKey: {
        iv: p.wrappedProjectKeyIv,
        ciphertext: p.wrappedProjectKeyCiphertext,
      },
    })),
  });
});

export const POST = handler(async (req) => {
  const auth = await requireAuth(req);
  const dto = await readJson(req, CreateProjectRequestSchema);
  const project = await createProject(auth.userId, dto);
  await audit({
    userId: auth.userId,
    action: "project.created",
    targetType: "project",
    targetId: project.id,
    metadata: { name: project.name },
  });
  return json({ project: projectToDto(project) }, 201);
});
