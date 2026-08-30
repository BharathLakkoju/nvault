import { requireAuth } from "@/server/auth/require-auth";
import { billingConfigured } from "@/server/env";
import { handler, json } from "@/server/http";
import {
  FREE_LIMITS,
  PRO_LIMITS,
  proPlanPriceLabel,
  teamTierInfo,
} from "@/server/billing/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Non-secret plan metadata for the upgrade UI. */
export const GET = handler(async (req) => {
  await requireAuth(req);
  return json({
    proPriceLabel: proPlanPriceLabel(),
    teamTiers: teamTierInfo(),
    billingEnabled: billingConfigured(),
    freeLimits: {
      maxPersonalProjects: FREE_LIMITS.maxPersonalProjects,
      maxVersionsPerFile: FREE_LIMITS.maxVersionsPerFile,
      maxBrowserSessions: FREE_LIMITS.maxBrowserSessions,
      maxCliTokens: FREE_LIMITS.maxCliTokens,
    },
    proLimits: {
      maxBrowserSessions: PRO_LIMITS.maxBrowserSessions,
      maxCliTokens: PRO_LIMITS.maxCliTokens,
    },
    /** @deprecated use freeLimits.maxPersonalProjects */
    freeMaxPersonalProjects: FREE_LIMITS.maxPersonalProjects,
  });
});
