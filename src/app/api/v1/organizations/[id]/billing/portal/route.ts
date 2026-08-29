import { requireAuth } from "@/server/auth/require-auth";
import { clientIp, handler, json } from "@/server/http";
import { enforceRateLimit } from "@/server/ratelimit";
import { getBillingPortalUrl } from "@/server/billing/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Short-lived Polar customer-portal URL for the org's billing owner. Card
 * updates, invoices and cancellation all happen on Polar's hosted pages.
 */
export const GET = handler(async (req, { params }) => {
  const auth = await requireAuth(req);
  const ip = clientIp(req);
  await enforceRateLimit(`billing/portal:${auth.userId}`, { limit: 15, windowMs: 60_000 });
  await enforceRateLimit(`billing/portal-ip:${ip ?? "unknown"}`, { limit: 30, windowMs: 60_000 });

  const url = await getBillingPortalUrl(auth.userId, params.id);
  return json({ url });
});
