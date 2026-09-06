import { requireAuth } from "@/server/auth/require-auth";
import { beginPasskeyRegistration } from "@/server/auth/webauthn";
import { handler, json } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req) => {
  const auth = await requireAuth(req);
  const result = await beginPasskeyRegistration(auth.userId);
  return json(result);
});
