import { StartDeviceAuthRequestSchema } from "@/lib/schemas";
import { pruneExpiredDeviceAuth, startDeviceAuth } from "@/server/auth/device-auth";
import { clientIp, handler, json, readJson } from "@/server/http";
import { enforceRateLimit } from "@/server/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** RFC 8628 device authorization — step 1: CLI requests a user code. */
export const POST = handler(async (req) => {
  const ip = clientIp(req);
  await enforceRateLimit(`auth/device/start:${ip ?? "unknown"}`, { limit: 20, windowMs: 60_000 });
  void pruneExpiredDeviceAuth();
  const dto = await readJson(req, StartDeviceAuthRequestSchema);
  const result = await startDeviceAuth({
    clientName: dto.clientName,
    userAgent: req.headers.get("user-agent") ?? undefined,
    ipAddress: ip,
  });
  return json(result, 201);
});
