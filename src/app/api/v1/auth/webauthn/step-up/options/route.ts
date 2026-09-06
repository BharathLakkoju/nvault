import { requireAuth } from "@/server/auth/require-auth";
import { beginPasskeyStepUp } from "@/server/auth/webauthn";
import { handler, json } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req) => {
  const auth = await requireAuth(req);
  const result = await beginPasskeyStepUp(auth.userId);
  return json(result);
});
