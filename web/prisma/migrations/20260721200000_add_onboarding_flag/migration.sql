-- Additive: first-run onboarding flag. NULL = the /welcome flow has not run yet.
ALTER TABLE "UserSettings" ADD COLUMN "onboardedAt" TIMESTAMP(3);

-- Accounts that already have journal data are considered onboarded, so the
-- welcome flow never appears for them. (Users with data but no UserSettings
-- row are handled lazily by needsOnboarding in src/lib/onboarding.ts.)
UPDATE "UserSettings"
SET "onboardedAt" = CURRENT_TIMESTAMP
WHERE "onboardedAt" IS NULL
  AND "userId" IN (
    SELECT "userId" FROM "UserMovie"
    UNION
    SELECT "userId" FROM "LogEntry" WHERE "userId" IS NOT NULL
  );
