-- CLI Personal Access Tokens.
--
-- Additive only: three nullable columns on "sessions" plus one unique
-- index. Existing rows are unaffected (browser sessions leave all three
-- NULL). No data migration, no backfill.

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "apiTokenHash" TEXT,
ADD COLUMN     "apiTokenName" TEXT,
ADD COLUMN     "apiTokenPrefix" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "sessions_apiTokenHash_key" ON "sessions"("apiTokenHash");
