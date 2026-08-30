-- AlterTable: lifetime version counter that drives the free-tier history cap.
-- Monotonic — the application never decrements it, so deleting an old version
-- does not let a free account upload another one.
ALTER TABLE "project_files" ADD COLUMN "versionsCreated" INTEGER NOT NULL DEFAULT 0;

-- Backfill existing files with the number of versions they currently hold.
-- These accounts were never capped, so the live count is the least-surprising
-- starting high-water mark: a file already at or above the free limit is
-- frozen for new uploads, everything below keeps its remaining headroom.
UPDATE "project_files" pf
SET "versionsCreated" = (
  SELECT COUNT(*) FROM "file_versions" fv WHERE fv."fileId" = pf."id"
);
