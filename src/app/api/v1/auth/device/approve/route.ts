import { ApproveDeviceAuthRequestSchema } from "@/lib/schemas";
import { audit } from "@/server/audit";
import { approveDeviceAuth } from "@/server/auth/device-auth";
import { requireAuth } from "@/server/auth/require-auth";
import { clientIp, handler, noContent, readJson } from "@/server/http";
import { enforceRateLimit } from "@/server/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** RFC 8628 device authorization — step 3: user approves in the browser. */
export const POST = handler(async (req) => {
  const auth = await requireAuth(req);
  await enforceRateLimit(`auth/device/approve:${auth.userId}`, { limit: 20, windowMs: 60_000 });
  const dto = await readJson(req, ApproveDeviceAuthRequestSchema);
  await approveDeviceAuth(auth.userId, dto.userCode);
  await audit({
    userId: auth.userId,
    action: "auth.device_approved",
    targetType: "session",
    ipAddress: clientIp(req),
  });
  return noContent();
});
