import { db } from "./db";
import { ApiError } from "./http";

/**
 * Fixed-window rate limiter backed by Postgres, so the limit holds across
 * every concurrent serverless instance without an external store (Redis /
 * Upstash). One small upsert per limited request; old windows are pruned
 * opportunistically on a small fraction of calls.
 */
export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

export async function enforceRateLimit(bucketKey: string, rule: RateLimitRule): Promise<void> {
  const windowStart = new Date(Math.floor(Date.now() / rule.windowMs) * rule.windowMs);

  const row = await db.rateLimitHit.upsert({
    where: { bucket_windowStart: { bucket: bucketKey, windowStart } },
    create: { bucket: bucketKey, windowStart, count: 1 },
    update: { count: { increment: 1 } },
  });

  if (Math.random() < 0.02) {
    const cutoff = new Date(Date.now() - rule.windowMs * 3);
    await db.rateLimitHit.deleteMany({ where: { windowStart: { lt: cutoff } } }).catch(() => {});
  }

  if (row.count > rule.limit) {
    throw new ApiError(429, "Too many requests — please slow down and try again shortly.");
  }
}
