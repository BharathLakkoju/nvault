-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('PRO', 'TEAM');

-- AlterTable
-- Existing subscription rows are all organization subscriptions -> 'TEAM'
-- (handled by the column default). PRO subscriptions have no organization.
ALTER TABLE "subscriptions" ADD COLUMN     "plan" "SubscriptionPlan" NOT NULL DEFAULT 'TEAM',
ALTER COLUMN "organizationId" DROP NOT NULL;

-- One PRO subscription per user. Prisma can't express a WHERE on @@unique,
-- so this partial unique index is hand-written. TEAM rows are unaffected
-- (their uniqueness is already enforced by subscriptions_organizationId_key).
CREATE UNIQUE INDEX "subscriptions_owner_pro_key"
    ON "subscriptions" ("ownerUserId")
    WHERE "plan" = 'PRO';
