-- CreateEnum
CREATE TYPE "DeviceAuthStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- CreateTable
CREATE TABLE "device_auth_requests" (
    "id" TEXT NOT NULL,
    "deviceCodeHash" TEXT NOT NULL,
    "userCode" TEXT NOT NULL,
    "status" "DeviceAuthStatus" NOT NULL DEFAULT 'PENDING',
    "userId" TEXT,
    "approvedToken" TEXT,
    "approvedSessionId" TEXT,
    "clientName" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "pollCount" INTEGER NOT NULL DEFAULT 0,
    "lastPollAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_auth_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_auth_requests_deviceCodeHash_key" ON "device_auth_requests"("deviceCodeHash");

-- CreateIndex
CREATE UNIQUE INDEX "device_auth_requests_userCode_key" ON "device_auth_requests"("userCode");

-- CreateIndex
CREATE INDEX "device_auth_requests_expiresAt_idx" ON "device_auth_requests"("expiresAt");

-- AddForeignKey
ALTER TABLE "device_auth_requests" ADD CONSTRAINT "device_auth_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
