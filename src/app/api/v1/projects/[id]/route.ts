import { UpdateProjectRequestSchema } from "@/lib/schemas";
import { audit } from "@/server/audit";
import { requireAuth } from "@/server/auth/require-auth";
import { authorizeProject } from "@/server/authz/project-access";
import { clientIp, handler, json, noContent, readJson } from "@/server/http";
import { deleteProject, projectToDto, updateProject } from "@/server/projects/service";
import { db } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function withOrg(project: { organizationId: string | null }) {
  if (!project.organizationId) return null;
  return db.organization.findUnique({
    where: { id: project.organizationId },
    select: { id: true, name: true, slug: true },
  });
}

export const GET = handler(async (req, { params }) => {
  const auth = await requireAuth(req);
  const { project } = await authorizeProject(auth.userId, params.id, "read");
  return json({ project: projectToDto(project, await withOrg(project)) });
});

export const PATCH = handler(async (req, { params }) => {
  const auth = await requireAuth(req);
  const { project } = await authorizeProject(auth.userId, params.id, "manage");
  const dto = await readJson(req, UpdateProjectRequestSchema);
  const updated = await updateProject(auth.userId, project, dto);
  if (dto.name !== undefined && updated.name !== project.name) {
    await audit({
      userId: auth.userId,
      organizationId: updated.organizationId,
      action: "project.renamed",
      targetType: "project",
      targetId: updated.id,
      metadata: { name: updated.name },
      ipAddress: clientIp(req),
    });
  }
  if (dto.gitRemoteUrl !== undefined && updated.gitRemoteUrl !== project.gitRemoteUrl) {
    await audit({
      userId: auth.userId,
      organizationId: updated.organizationId,
      action: "project.git_remote_updated",
      targetType: "project",
      targetId: updated.id,
      metadata: { gitRemoteUrl: updated.gitRemoteUrl ?? "" },
      ipAddress: clientIp(req),
    });
  }
  return json({ project: projectToDto(updated, await withOrg(updated)) });
});

export const DELETE = handler(async (req, { params }) => {
  const auth = await requireAuth(req);
  const { project } = await authorizeProject(auth.userId, params.id, "manage");
  await deleteProject(project.id);
  await audit({
    userId: auth.userId,
    organizationId: project.organizationId,
    action: "project.deleted",
    targetType: "project",
    targetId: project.id,
    metadata: { name: project.name },
    ipAddress: clientIp(req),
  });
  return noContent();
});
