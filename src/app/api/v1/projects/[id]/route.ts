import { RenameProjectRequestSchema } from "@/lib/schemas";
import { audit } from "@/server/audit";
import { requireAuth } from "@/server/auth/require-auth";
import { handler, json, noContent, readJson } from "@/server/http";
import {
  deleteProject,
  getOwnedProject,
  projectToDto,
  renameProject,
} from "@/server/projects/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (req, { params }) => {
  const auth = await requireAuth(req);
  const project = await getOwnedProject(auth.userId, params.id);
  return json({ project: projectToDto(project) });
});

export const PATCH = handler(async (req, { params }) => {
  const auth = await requireAuth(req);
  const dto = await readJson(req, RenameProjectRequestSchema);
  const project = await renameProject(auth.userId, params.id, dto.name);
  await audit({
    userId: auth.userId,
    action: "project.renamed",
    targetType: "project",
    targetId: project.id,
    metadata: { name: project.name },
  });
  return json({ project: projectToDto(project) });
});

export const DELETE = handler(async (req, { params }) => {
  const auth = await requireAuth(req);
  const project = await getOwnedProject(auth.userId, params.id);
  await deleteProject(auth.userId, params.id);
  await audit({
    userId: auth.userId,
    action: "project.deleted",
    targetType: "project",
    targetId: params.id,
    metadata: { name: project.name },
  });
  return noContent();
});
