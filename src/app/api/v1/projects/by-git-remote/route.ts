import { requireAuth } from "@/server/auth/require-auth";
import { handler, json } from "@/server/http";
import { findProjectByGitRemote, projectToDto } from "@/server/projects/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (req) => {
  const auth = await requireAuth(req);
  const url = new URL(req.url).searchParams.get("url");
  const project = url ? await findProjectByGitRemote(auth.userId, url) : null;
  return json({ project: project ? projectToDto(project, project.organization) : null });
});
