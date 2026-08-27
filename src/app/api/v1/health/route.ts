import { handler, json } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  return json({ status: "ok", timestamp: new Date().toISOString() });
});
