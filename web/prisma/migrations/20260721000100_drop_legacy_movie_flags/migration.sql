-- Finish the multi-user migration: UserMovie is the single source of truth for
-- per-user state, so the legacy global flags on Movie are removed. This migration
-- first preserves any state that still lives only on Movie by copying it into the
-- owner's UserMovie rows, then drops the redundant columns and their indexes.
--
-- The "owner" is the single user with role = 'OWNER'. If no owner row exists yet,
-- the CROSS JOIN yields no rows and the backfill is a safe no-op.

-- 1) Preserve legacy boolean/rating state into the owner's UserMovie rows.
INSERT INTO "UserMovie" ("userId", "movieId", "watched", "favorite", "watchlist", "watchlistAddedAt", "rating", "createdAt", "updatedAt")
SELECT o.id, m.id, m."watched", m."favorite", m."watchlist", m."watchlistAddedAt", m."rating", now(), now()
FROM "Movie" m
CROSS JOIN (SELECT id FROM "User" WHERE role = 'OWNER' ORDER BY "createdAt" ASC LIMIT 1) o
WHERE m."watched" = true
   OR m."favorite" = true
   OR m."watchlist" = true
   OR m."rating" IS NOT NULL
   OR m."favoriteRank" IS NOT NULL
ON CONFLICT ("userId", "movieId") DO UPDATE SET
  "watched"          = "UserMovie"."watched" OR EXCLUDED."watched",
  "favorite"         = "UserMovie"."favorite" OR EXCLUDED."favorite",
  "watchlist"        = "UserMovie"."watchlist" OR EXCLUDED."watchlist",
  "watchlistAddedAt" = COALESCE("UserMovie"."watchlistAddedAt", EXCLUDED."watchlistAddedAt"),
  "rating"           = COALESCE("UserMovie"."rating", EXCLUDED."rating");

-- 2) Carry over favoriteRank only where the owner has no rank yet and the target
--    rank slot is free (UserMovie enforces a per-user unique favoriteRank).
UPDATE "UserMovie" um
SET "favoriteRank" = m."favoriteRank"
FROM "Movie" m,
     (SELECT id FROM "User" WHERE role = 'OWNER' ORDER BY "createdAt" ASC LIMIT 1) o
WHERE um."movieId" = m.id
  AND um."userId" = o.id
  AND m."favoriteRank" IS NOT NULL
  AND um."favoriteRank" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "UserMovie" x WHERE x."userId" = o.id AND x."favoriteRank" = m."favoriteRank"
  );

-- 3) Drop the now-redundant global columns and their indexes.
DROP INDEX "Movie_favoriteRank_key";
DROP INDEX "Movie_watched_idx";
DROP INDEX "Movie_favorite_idx";
DROP INDEX "Movie_watchlist_watchlistAddedAt_idx";

ALTER TABLE "Movie" DROP COLUMN "favorite",
DROP COLUMN "favoriteRank",
DROP COLUMN "rating",
DROP COLUMN "watched",
DROP COLUMN "watchlist",
DROP COLUMN "watchlistAddedAt";
