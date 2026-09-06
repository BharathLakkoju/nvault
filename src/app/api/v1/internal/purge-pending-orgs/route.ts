import { timingSafeEqual } from "node:crypto";
import { env } from "@/server/env";
import { ApiError, handler, json } from "@/server/http";
import { purgeExpiredPending, pruneProcessedWebhookEvents } from "@/server/billing/service";
import { reconcileOrganizationEnrollment } from "@/server/organizations/reconcile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Deletes organizations abandoned in PENDING_PAYMENT for more than 7 days.
 * Invoked by Vercel Cron (see vercel.json) with a GET and
 * `Authorization: Bearer ${CRON_SECRET}`.
 */
export const GET = handler(async (req) => {
  if (!authorized(req)) throw new ApiError(401, "Unauthorized");
  const purged = await purgeExpiredPending();
  await pruneProcessedWebhookEvents();
  const enrollment = await reconcileOrganizationEnrollment();
  return json({ purged, enrollment });
});
