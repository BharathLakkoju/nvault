import { db } from "@/server/db";
import { handler, json } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  let dbStatus: "ok" | "error" = "ok";
  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = "error";
  }
  const healthy = dbStatus === "ok";
  return json(
    {
      status: healthy ? "ok" : "degraded",
      db: dbStatus,
      timestamp: new Date().toISOString(),
    },
    healthy ? 200 : 503,
  );
});
