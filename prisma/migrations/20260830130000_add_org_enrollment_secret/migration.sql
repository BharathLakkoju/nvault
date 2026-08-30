-- Organization Enrollment Secret (OES) + encrypted member roster.
--
-- Adds the OES-wrapped Org Key (how a new member obtains the key without the
-- server in the delivery path) and the pubkey-pinning roster consulted at
-- key rotation. Greenfield: organizations created before this migration are
-- not expected to exist; the NOT NULL columns therefore carry no backfill.

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "enrollmentKdfIterations" INTEGER NOT NULL,
ADD COLUMN     "enrollmentKdfSalt" TEXT NOT NULL,
ADD COLUMN     "enrollmentKeyEpoch" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "enrollmentWrappedOrgKeyCiphertext" TEXT NOT NULL,
ADD COLUMN     "enrollmentWrappedOrgKeyIv" TEXT NOT NULL,
ADD COLUMN     "rosterCiphertext" TEXT NOT NULL,
ADD COLUMN     "rosterIv" TEXT NOT NULL,
ADD COLUMN     "rosterVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "organization_memberships" ADD COLUMN     "pinnedPublicKey" TEXT;
