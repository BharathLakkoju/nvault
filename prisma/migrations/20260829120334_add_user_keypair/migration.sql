-- AlterTable
ALTER TABLE "users" ADD COLUMN     "publicKey" TEXT,
ADD COLUMN     "wrappedPrivateKeyCiphertext" TEXT,
ADD COLUMN     "wrappedPrivateKeyIv" TEXT;
