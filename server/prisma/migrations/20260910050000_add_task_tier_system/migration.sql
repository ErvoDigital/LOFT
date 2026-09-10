-- Smart Priority tier system: replaces the LOW/MEDIUM/HIGH/URGENT priority
-- with a 4-tier scheme and replaces the EASY/MEDIUM/HARD difficulty with a
-- precise minutes estimate. Existing values are backfilled rather than
-- dropped outright so no in-flight task loses its prioritization.

ALTER TABLE "Task" ADD COLUMN "tier" TEXT NOT NULL DEFAULT 'TIER_3';
ALTER TABLE "Task" ADD COLUMN "estimatedMinutes" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "Task" ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Task" ADD COLUMN "isSnoozed" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Task" SET "tier" = CASE "priority"
  WHEN 'URGENT' THEN 'TIER_1'
  WHEN 'HIGH' THEN 'TIER_2'
  WHEN 'MEDIUM' THEN 'TIER_3'
  WHEN 'LOW' THEN 'TIER_4'
  ELSE 'TIER_3'
END;

UPDATE "Task" SET "estimatedMinutes" = CASE "difficulty"
  WHEN 'EASY' THEN 60
  WHEN 'MEDIUM' THEN 120
  WHEN 'HARD' THEN 240
  ELSE 30
END;

ALTER TABLE "Task" DROP COLUMN "priority";
ALTER TABLE "Task" DROP COLUMN "difficulty";
