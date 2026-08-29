import { Polar } from "@polar-sh/sdk";
import type { SubscriptionTier } from "@/generated/prisma/client";
import { Webhook, WebhookVerificationError } from "standardwebhooks";
import { appOrigin, billingConfigured, env } from "../env";
import { ApiError } from "../http";

/**
 * Thin wrapper around the Polar SDK. Everything payment-related is isolated
 * here so the rest of the app never imports `@polar-sh/sdk` directly and the
 * provider stays swappable.
 *
 * No secret / card data flows through this module — Polar hosts checkout and
 * the customer portal; we only ever hold opaque ids and a status string.
 */

let client: Polar | undefined;

function polar(): Polar {
  if (!billingConfigured()) {
    // Reachable only if a billing route is hit while POLAR_* is unset (dev).
    throw new ApiError(503, "Billing is not configured on this server.");
  }
  if (!client) {
    client = new Polar({
      accessToken: env.POLAR_ACCESS_TOKEN,
      server: env.POLAR_SERVER,
    });
  }
  return client;
}

const TEAM_TIER_PRODUCT_ENV: Record<SubscriptionTier, keyof typeof env> = {
  STARTER: "POLAR_TEAM_STARTER_PRODUCT_ID",
  GROWTH: "POLAR_TEAM_GROWTH_PRODUCT_ID",
  SCALE: "POLAR_TEAM_SCALE_PRODUCT_ID",
};

export function teamTierProductId(tier: SubscriptionTier): string {
  return env[TEAM_TIER_PRODUCT_ENV[tier]] as string;
}

/** Reverse lookup: which Team tier a Polar product id corresponds to (or null). */
export function tierForProductId(productId: string | null | undefined): SubscriptionTier | null {
  if (!productId) return null;
  for (const tier of ["STARTER", "GROWTH", "SCALE"] as const) {
    if (env[TEAM_TIER_PRODUCT_ENV[tier]] === productId) return tier;
  }
  return null;
}

export interface OrgCheckoutInput {
  organizationId: string;
  organizationName: string;
  ownerUserId: string;
  ownerEmail: string;
  tier: SubscriptionTier;
}

/**
 * Creates a Polar checkout session for a Team size tier and returns the
 * hosted checkout URL. `plan` + `organizationId` + `tier` are stamped into
 * the subscription metadata so the webhook can resolve what got paid for.
 */
export async function createOrgCheckout(input: OrgCheckoutInput): Promise<string> {
  const origin = appOrigin();
  try {
    const checkout = await polar().checkouts.create({
      products: [teamTierProductId(input.tier)],
      externalCustomerId: input.ownerUserId,
      customerEmail: input.ownerEmail,
      successUrl: `${origin}/organizations/${input.organizationId}?welcome=1`,
      metadata: {
        plan: "TEAM",
        organizationId: input.organizationId,
        ownerUserId: input.ownerUserId,
        tier: input.tier,
      },
    });
    return checkout.url;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    console.error("[billing] checkout creation failed:", err);
    throw new ApiError(502, "Could not start checkout. Please try again.");
  }
}

/**
 * Switches an existing Polar subscription to a different product (Team tier
 * change). Polar prorates and emits a `subscription.updated` webhook with
 * the new product id, which our reducer uses to update the stored tier.
 */
export async function updateSubscriptionProduct(
  polarSubscriptionId: string,
  tier: SubscriptionTier,
): Promise<void> {
  try {
    await polar().subscriptions.update({
      id: polarSubscriptionId,
      subscriptionUpdate: { productId: teamTierProductId(tier) },
    });
  } catch (err) {
    console.error("[billing] subscription product update failed:", err);
    throw new ApiError(502, "Could not change the plan. Please try again.");
  }
}

export interface ProCheckoutInput {
  userId: string;
  userEmail: string;
}

/**
 * Creates a Polar checkout session for the per-user Pro plan. `plan` + `userId`
 * go into the metadata so the webhook knows which account to entitle.
 */
export async function createProCheckout(input: ProCheckoutInput): Promise<string> {
  const origin = appOrigin();
  try {
    const checkout = await polar().checkouts.create({
      products: [env.POLAR_PRO_PRODUCT_ID as string],
      externalCustomerId: input.userId,
      customerEmail: input.userEmail,
      successUrl: `${origin}/settings/billing?welcome=1`,
      metadata: { plan: "PRO", userId: input.userId },
    });
    return checkout.url;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    console.error("[billing] pro checkout creation failed:", err);
    throw new ApiError(502, "Could not start checkout. Please try again.");
  }
}

/**
 * Creates a short-lived customer-portal session for the org's billing owner
 * and returns its URL. Card updates, invoices and cancellation all happen
 * there — nvault has no billing UI of its own.
 */
export async function createBillingPortalUrl(ownerUserId: string): Promise<string> {
  try {
    const session = await polar().customerSessions.create({
      externalCustomerId: ownerUserId,
    });
    return session.customerPortalUrl;
  } catch (err) {
    console.error("[billing] portal session failed:", err);
    throw new ApiError(502, "Could not open the billing portal. Please try again.");
  }
}

export interface VerifiedWebhook {
  /** Standard Webhooks delivery id (the `webhook-id` header) — used for dedupe. */
  id: string;
  type: string;
  data: Record<string, unknown>;
}

/**
 * Verifies a raw webhook request body against POLAR_WEBHOOK_SECRET (Standard
 * Webhooks HMAC over `${id}.${timestamp}.${body}`) and returns the parsed
 * event. Throws ApiError(400) on a bad or missing signature.
 *
 * The secret transformation mirrors the Polar SDK exactly: Polar's dashboard
 * secrets are plain strings, and both Polar's `validateEvent` and this code
 * feed `base64(utf8(secret))` to the Standard Webhooks verifier.
 */
export function verifyWebhook(
  rawBody: string,
  headers: Record<string, string>,
): VerifiedWebhook {
  if (!env.POLAR_WEBHOOK_SECRET) {
    throw new ApiError(503, "Billing webhook is not configured.");
  }
  const base64Secret = Buffer.from(env.POLAR_WEBHOOK_SECRET, "utf-8").toString("base64");
  let parsed: unknown;
  try {
    parsed = new Webhook(base64Secret).verify(rawBody, headers);
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      throw new ApiError(400, "Invalid webhook signature");
    }
    throw new ApiError(400, "Malformed webhook payload");
  }
  const event = parsed as { type?: unknown; data?: unknown };
  if (typeof event.type !== "string" || typeof event.data !== "object" || event.data === null) {
    throw new ApiError(400, "Malformed webhook payload");
  }
  const id = headers["webhook-id"] ?? headers["Webhook-Id"] ?? "";
  return { id, type: event.type, data: event.data as Record<string, unknown> };
}

/** Standard Webhooks signer — test-only helper for the integration suite. */
export function signWebhookForTest(
  rawBody: string,
  opts: { id: string; timestamp: Date },
): Record<string, string> {
  const base64Secret = Buffer.from(env.POLAR_WEBHOOK_SECRET as string, "utf-8").toString("base64");
  const wh = new Webhook(base64Secret);
  const signature = wh.sign(opts.id, opts.timestamp, rawBody);
  return {
    "webhook-id": opts.id,
    "webhook-timestamp": Math.floor(opts.timestamp.getTime() / 1000).toString(),
    "webhook-signature": signature,
  };
}
