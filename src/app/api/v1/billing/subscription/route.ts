import { requireAuth } from "@/server/auth/require-auth";
import { handler, json } from "@/server/http";
import { getUserProSubscription, subscriptionToDto } from "@/server/billing/service";
import { proPlanPriceLabel } from "@/server/billing/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The caller's personal (Pro) subscription state, for the billing page. */
export const GET = handler(async (req) => {
  const auth = await requireAuth(req);
  const sub = await getUserProSubscription(auth.userId);
  return json({
    priceLabel: proPlanPriceLabel(),
    pro: subscriptionToDto(sub, auth.userId),
  });
});
