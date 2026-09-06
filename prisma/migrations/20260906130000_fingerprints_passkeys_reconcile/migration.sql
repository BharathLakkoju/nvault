-- Rename plaintext SHA-256 oracle to project-keyed HMAC fingerprint.
ALTER TABLE "file_versions" RENAME COLUMN "plaintextSha256" TO "plaintextFingerprint";

-- Passkey credentials and step-up auth timestamp on sessions.
ALTER TABLE "sessions" ADD COLUMN "stepUpVerifiedAt" TIMESTAMP(3);

CREATE TABLE "webauthn_credentials" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "counter" BIGINT NOT NULL,
    "deviceType" TEXT,
    "backedUp" BOOLEAN NOT NULL DEFAULT false,
    "transports" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webauthn_credentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "webauthn_credentials_credentialId_key" ON "webauthn_credentials"("credentialId");
CREATE INDEX "webauthn_credentials_userId_idx" ON "webauthn_credentials"("userId");

ALTER TABLE "webauthn_credentials" ADD CONSTRAINT "webauthn_credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Membership lifecycle: enrollment window can expire without completing key grant.
ALTER TYPE "OrgMembershipStatus" ADD VALUE 'EXPIRED';
