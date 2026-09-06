import { requireAuth } from "@/server/auth/require-auth";
import { listPasskeys } from "@/server/auth/webauthn";
import { handler, json } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (req) => {
  const auth = await requireAuth(req);
  const credentials = await listPasskeys(auth.userId);
  return json({ credentials });
});
