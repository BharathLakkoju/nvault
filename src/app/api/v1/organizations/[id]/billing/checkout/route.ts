import { ChangeTierRequestSchema } from "@/lib/schemas";
import { requireAuth } from "@/server/auth/require-auth";
import { clientIp, handler, json, readJsonOptional } from "@/server/http";
import { enforceRateLimit } from "@/server/ratelimit";
import { startOrgCheckout } from "@/server/billing/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns a fresh Polar checkout URL for an org that is PENDING_PAYMENT
 * (abandoned checkout) or SUSPENDED (renew). Owner only. An optional `tier`
 * in the body switches the size plan for this checkout.
 */
export const POST = handler(async (req, { params }) => {
  const auth = await requireAuth(req);
  const ip = clientIp(req);
  await enforceRateLimit(`billing/checkout:${auth.userId}`, { limit: 10, windowMs: 60_000 });
  await enforceRateLimit(`billing/checkout-ip:${ip ?? "unknown"}`, { limit: 20, windowMs: 60_000 });

  const body = await readJsonOptional(req, ChangeTierRequestSchema.partial());
  const url = await startOrgCheckout(auth.userId, params.id, body.tier);
  return json({ url });
});
