import { me } from "@/server/auth/service";
import { requireAuth } from "@/server/auth/require-auth";
import { handler, json } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (req) => {
  const auth = await requireAuth(req);
  return json(await me(auth.userId));
});
