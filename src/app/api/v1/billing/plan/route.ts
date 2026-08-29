import { requireAuth } from "@/server/auth/require-auth";
import { billingConfigured } from "@/server/env";
import { handler, json } from "@/server/http";
import { proPlanPriceLabel, teamTierInfo, FREE_LIMITS } from "@/server/billing/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Non-secret plan metadata for the upgrade UI. */
export const GET = handler(async (req) => {
  await requireAuth(req);
  return json({
    proPriceLabel: proPlanPriceLabel(),
    teamTiers: teamTierInfo(),
    billingEnabled: billingConfigured(),
    freeMaxPersonalProjects: FREE_LIMITS.maxPersonalProjects,
  });
});
