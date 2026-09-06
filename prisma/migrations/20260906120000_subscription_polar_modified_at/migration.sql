-- Store Polar subscription modified_at for out-of-order webhook protection.
ALTER TABLE "subscriptions" ADD COLUMN "polarModifiedAt" TIMESTAMP(3);
