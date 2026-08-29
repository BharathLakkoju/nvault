import { requireAuth } from "@/server/auth/require-auth";
import { billingConfigured } from "@/server/env";
import { ApiError, clientIp, handler, json } from "@/server/http";
import { enforceRateLimit } from "@/server/ratelimit";
import { startProCheckout } from "@/server/billing/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Returns a Polar checkout URL for the per-user Pro plan. */
export const POST = handler(async (req) => {
  const auth = await requireAuth(req);
  if (!billingConfigured()) {
    throw new ApiError(503, "Billing is not configured on this server.");
  }
  const ip = clientIp(req);
  await enforceRateLimit(`billing/pro-checkout:${auth.userId}`, { limit: 10, windowMs: 60_000 });
  await enforceRateLimit(`billing/pro-checkout-ip:${ip ?? "unknown"}`, {
    limit: 20,
    windowMs: 60_000,
  });

  const url = await startProCheckout(auth.userId);
  return json({ url });
});
