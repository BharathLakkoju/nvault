import { listAuditForUser } from "@/server/audit";
import { requireAuth } from "@/server/auth/require-auth";
import { handler, json } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (req) => {
  const auth = await requireAuth(req);
  const entries = await listAuditForUser(auth.userId);
  return json({ entries });
});
