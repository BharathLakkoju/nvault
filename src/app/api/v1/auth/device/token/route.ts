import { PollDeviceAuthRequestSchema } from "@/lib/schemas";
import { pollDeviceAuth, pruneExpiredDeviceAuth } from "@/server/auth/device-auth";
import { clientIp, handler, json, readJson } from "@/server/http";
import { enforceRateLimit } from "@/server/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** RFC 8628 device authorization — step 2: CLI polls until approved. */
export const POST = handler(async (req) => {
  const ip = clientIp(req);
  await enforceRateLimit(`auth/device/poll:${ip ?? "unknown"}`, { limit: 120, windowMs: 60_000 });
  void pruneExpiredDeviceAuth();
  const dto = await readJson(req, PollDeviceAuthRequestSchema);
  const result = await pollDeviceAuth(dto.device_code);

  switch (result.status) {
    case "pending":
      return json({ error: "authorization_pending" }, 400);
    case "slow_down":
      return json({ error: "slow_down" }, 429);
    case "expired":
      return json({ error: "expired_token" }, 400);
    case "denied":
      return json({ error: "access_denied" }, 403);
    case "approved":
      return json({ token: result.token, user: { email: result.userEmail } });
  }
});
