import { ChangeTierRequestSchema } from "@/lib/schemas";
import { requireAuth } from "@/server/auth/require-auth";
import { clientIp, handler, json, readJson } from "@/server/http";
import { enforceRateLimit } from "@/server/ratelimit";
import { changeOrgTier } from "@/server/billing/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Switches an active organization to a different size tier. Owner only.
 * Polar prorates; the `subscription.updated` webhook syncs the stored tier.
 * A downgrade is refused while the org has more members than the target
 * tier allows.
 */
export const POST = handler(async (req, { params }) => {
  const auth = await requireAuth(req);
  await enforceRateLimit(`billing/change-tier:${auth.userId}`, { limit: 10, windowMs: 60_000 });
  await enforceRateLimit(`billing/change-tier-ip:${clientIp(req) ?? "unknown"}`, {
    limit: 20,
    windowMs: 60_000,
  });

  const dto = await readJson(req, ChangeTierRequestSchema);
  await changeOrgTier(auth.userId, params.id, dto.tier);
  return json({ ok: true });
});
