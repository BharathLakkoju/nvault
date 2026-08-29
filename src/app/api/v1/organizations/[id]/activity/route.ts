import { requireAuth } from "@/server/auth/require-auth";
import { authorizeOrg } from "@/server/authz/org-access";
import { listAuditForOrg } from "@/server/audit";
import { handler, json } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (req, { params }) => {
  const auth = await requireAuth(req);
  await authorizeOrg(auth.userId, params.id, "ADMIN", "read");
  const entries = await listAuditForOrg(params.id);
  return json({
    entries: entries.map((e) => ({
      id: e.id,
      action: e.action,
      targetType: e.targetType,
      targetId: e.targetId,
      metadata: e.metadata,
      actorEmail: e.user?.email ?? null,
      createdAt: e.createdAt,
    })),
  });
});
