import { requireAuth } from "@/server/auth/require-auth";
import { clientIp, handler, json } from "@/server/http";
import { enforceRateLimit } from "@/server/ratelimit";
import { getPersonalBillingPortalUrl } from "@/server/billing/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Short-lived Polar customer-portal URL for the caller's own billing (Pro).
 * The same portal also lists any org subscriptions they pay for.
 */
export const GET = handler(async (req) => {
  const auth = await requireAuth(req);
  const ip = clientIp(req);
  await enforceRateLimit(`billing/portal:${auth.userId}`, { limit: 15, windowMs: 60_000 });
  await enforceRateLimit(`billing/portal-ip:${ip ?? "unknown"}`, { limit: 30, windowMs: 60_000 });

  const url = await getPersonalBillingPortalUrl(auth.userId);
  return json({ url });
});
