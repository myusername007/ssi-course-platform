-- Add detail-page fields to Course. longDescription is added with a
-- temporary default so it backfills cleanly on databases that already have
-- rows (e.g. production, with the 3 original demo courses); the default is
-- dropped afterward so it behaves as a required field for new rows, matching
-- the Prisma schema.
ALTER TABLE "Course" ADD COLUMN "longDescription" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Course" ADD COLUMN "level" TEXT;
ALTER TABLE "Course" ADD COLUMN "duration" TEXT;
ALTER TABLE "Course" ALTER COLUMN "longDescription" DROP DEFAULT;
