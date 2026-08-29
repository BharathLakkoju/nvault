-- CreateEnum
CREATE TYPE "OrgStatus" AS ENUM ('PENDING_PAYMENT', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAST_DUE', 'CANCELED');

-- AlterTable
-- New organizations start unpaid; existing rows are grandfathered to ACTIVE below.
ALTER TABLE "organizations" ADD COLUMN     "status" "OrgStatus" NOT NULL DEFAULT 'PENDING_PAYMENT';

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "polarCustomerId" TEXT,
    "polarSubscriptionId" TEXT,
    "polarProductId" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_webhook_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_organizationId_key" ON "subscriptions"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_polarSubscriptionId_key" ON "subscriptions"("polarSubscriptionId");

-- CreateIndex
CREATE INDEX "subscriptions_ownerUserId_idx" ON "subscriptions"("ownerUserId");

-- CreateIndex
CREATE INDEX "processed_webhook_events_createdAt_idx" ON "processed_webhook_events"("createdAt");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Backfill: grandfather every organization that existed before billing.
-- These teams predate the paywall and must never be locked out. Each is
-- marked ACTIVE and given a placeholder subscription (no Polar ids) owned by
-- its earliest OWNER. `applyPolarSubscription` will fill in the Polar ids if
-- such an org's owner ever runs a real checkout.
-- ---------------------------------------------------------------------------
UPDATE "organizations" SET "status" = 'ACTIVE';

INSERT INTO "subscriptions" (
    "id", "organizationId", "ownerUserId", "status",
    "cancelAtPeriodEnd", "createdAt", "updatedAt"
)
SELECT
    'sub_grandfathered_' || o."id",
    o."id",
    (
        SELECT m."userId"
        FROM "organization_memberships" m
        WHERE m."organizationId" = o."id" AND m."role" = 'OWNER'
        ORDER BY m."createdAt" ASC
        LIMIT 1
    ),
    'ACTIVE',
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "organizations" o
WHERE EXISTS (
    SELECT 1
    FROM "organization_memberships" m
    WHERE m."organizationId" = o."id" AND m."role" = 'OWNER'
);
