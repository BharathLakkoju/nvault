import { requireAuth } from "@/server/auth/require-auth";
import { searchFilesForUser } from "@/server/files/service";
import { handler, json } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (req) => {
  const auth = await requireAuth(req);
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const files = await searchFilesForUser(auth.userId, q);
  return json({ files });
});
