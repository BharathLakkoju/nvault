import { requireAuth } from "@/server/auth/require-auth";
import { listSessions } from "@/server/auth/session";
import { handler, json } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (req) => {
  const auth = await requireAuth(req);
  const sessions = await listSessions(auth.userId);
  return json({
    sessions: sessions.map((s) => ({ ...s, current: s.id === auth.sessionId })),
  });
});
