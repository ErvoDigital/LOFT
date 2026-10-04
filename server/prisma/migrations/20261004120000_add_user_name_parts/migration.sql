-- AlterTable
ALTER TABLE "User" ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "nickname" TEXT;

-- Backfill: split each existing name at its first run of whitespace. Nobody
-- has a nickname yet, so "name" (first + last) stays exactly what it was.
UPDATE "User"
SET "firstName" = substring(btrim("name") from '^\S+'),
    "lastName" = NULLIF(btrim(regexp_replace(btrim("name"), '^\S+', '')), '');
