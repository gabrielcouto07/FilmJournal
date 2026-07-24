-- DropIndex
DROP INDEX "UserMovie_watched_idx";

-- DropIndex
DROP INDEX "UserMovie_favorite_idx";

-- DropIndex
DROP INDEX "UserMovie_watchlist_watchlistAddedAt_idx";

-- CreateIndex
CREATE INDEX "UserMovie_userId_watched_idx" ON "UserMovie"("userId", "watched");

-- CreateIndex
CREATE INDEX "UserMovie_userId_watchlist_watchlistAddedAt_idx" ON "UserMovie"("userId", "watchlist", "watchlistAddedAt");

-- CreateIndex
CREATE INDEX "UserMovie_userId_rating_idx" ON "UserMovie"("userId", "rating");

-- CreateIndex
CREATE INDEX "LogEntry_userId_watchedAt_idx" ON "LogEntry"("userId", "watchedAt");

