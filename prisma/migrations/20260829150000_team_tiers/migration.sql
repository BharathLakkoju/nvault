-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('STARTER', 'GROWTH', 'SCALE');

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "tier" "SubscriptionTier";

-- Backfill: every existing TEAM subscription (grandfathered orgs and any
-- created before tiers) gets SCALE — the 100-member cap they already run
-- under, so nothing changes for them. PRO subscriptions stay null.
UPDATE "subscriptions" SET "tier" = 'SCALE' WHERE "plan" = 'TEAM';
