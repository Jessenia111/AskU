-- Pseudonym archive: allow multiple pseudonyms per user per course.
-- Old pseudonyms are archived (isActive = false) so historical posts keep their original name.

-- Add isActive flag (all existing pseudonyms are active)
ALTER TABLE "Pseudonym" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Drop the unique constraints that prevented multiple pseudonyms per user/course
DROP INDEX IF EXISTS "Pseudonym_userId_courseId_key";
DROP INDEX IF EXISTS "Pseudonym_courseId_publicName_key";
