import { handler, json } from "@/server/http";
import { verifyWebhook } from "@/server/billing/polar";
import {
  applyPolarSubscription,
  pruneProcessedWebhookEvents,
  type PolarSubscriptionData,
} from "@/server/billing/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Polar subscription events we act on. Everything else is acknowledged and ignored. */
const HANDLED = new Set([
  "subscription.created",
  "subscription.active",
  "subscription.updated",
  "subscription.canceled",
  "subscription.uncanceled",
  "subscription.revoked",
  "subscription.past_due",
]);

/**
 * Inbound Polar webhook. Authenticity is established by the Standard Webhooks
 * HMAC signature (verifyWebhook) — there is no bearer auth and no rate limit
 * here on purpose. Always returns 2xx once the signature checks out so Polar
 * stops retrying; processing errors are logged, not surfaced.
 */
export const POST = handler(async (req) => {
  const rawBody = await req.text();
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  // Throws ApiError(400) on a bad/missing signature — handler() renders it.
  const event = verifyWebhook(rawBody, headers);

  if (!HANDLED.has(event.type)) {
    return json({ received: true, ignored: event.type }, 202);
  }

  const d = event.data;
  const subData: PolarSubscriptionData = {
    id: String(d.id ?? ""),
    status: String(d.status ?? ""),
    currentPeriodEnd: (d.current_period_end as string | null | undefined) ?? null,
    cancelAtPeriodEnd: Boolean(d.cancel_at_period_end),
    customerId: (d.customer_id as string | null | undefined) ?? null,
    productId: (d.product_id as string | null | undefined) ?? null,
    metadata: (d.metadata as Record<string, unknown> | null | undefined) ?? null,
    modifiedAt:
      (d.modified_at as string | null | undefined) ??
      (d.updated_at as string | null | undefined) ??
      null,
  };

  try {
    const result = await applyPolarSubscription(event.id, event.type, subData);
    void pruneProcessedWebhookEvents();
    return json({ received: true, outcome: result.outcome }, 202);
  } catch (err) {
    console.error(`[billing] failed to apply ${event.type} ${event.id}:`, err);
    // 200 so Polar doesn't hammer retries on a bug of ours; the event id is
    // NOT recorded as processed on throw, so a manual redelivery can recover.
    return json({ received: true, outcome: "deferred" }, 200);
  }
});
