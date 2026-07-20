-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Movie" (
    "id" TEXT NOT NULL,
    "tmdbId" INTEGER,
    "title" TEXT NOT NULL,
    "year" INTEGER,
    "releaseDate" TIMESTAMP(3),
    "letterboxdUri" TEXT,
    "posterPath" TEXT,
    "backdropPath" TEXT,
    "preferredPosterPath" TEXT,
    "preferredBackdropPath" TEXT,
    "overview" TEXT,
    "tagline" TEXT,
    "runtime" INTEGER,
    "genres" TEXT,
    "directors" TEXT,
    "cast" TEXT,
    "tmdbRating" DOUBLE PRECISION,
    "tmdbVoteCount" INTEGER,
    "rating" DOUBLE PRECISION,
    "watched" BOOLEAN NOT NULL DEFAULT false,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "watchlist" BOOLEAN NOT NULL DEFAULT false,
    "watchlistAddedAt" TIMESTAMP(3),
    "favoriteRank" INTEGER,
    "imdbId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Movie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserMovie" (
    "userId" TEXT NOT NULL,
    "movieId" TEXT NOT NULL,
    "watched" BOOLEAN NOT NULL DEFAULT false,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "favoriteRank" INTEGER,
    "watchlist" BOOLEAN NOT NULL DEFAULT false,
    "watchlistAddedAt" TIMESTAMP(3),
    "rating" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserMovie_pkey" PRIMARY KEY ("userId","movieId")
);

-- CreateTable
CREATE TABLE "LogEntry" (
    "id" TEXT NOT NULL,
    "movieId" TEXT NOT NULL,
    "userId" TEXT,
    "sourceKey" TEXT NOT NULL,
    "dedupeKey" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceUri" TEXT,
    "loggedAt" TIMESTAMP(3),
    "watchedAt" TIMESTAMP(3),
    "rating" DOUBLE PRECISION,
    "review" TEXT,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "rewatch" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Movie_tmdbId_key" ON "Movie"("tmdbId");

-- CreateIndex
CREATE UNIQUE INDEX "Movie_letterboxdUri_key" ON "Movie"("letterboxdUri");

-- CreateIndex
CREATE UNIQUE INDEX "Movie_favoriteRank_key" ON "Movie"("favoriteRank");

-- CreateIndex
CREATE UNIQUE INDEX "Movie_imdbId_key" ON "Movie"("imdbId");

-- CreateIndex
CREATE INDEX "Movie_title_idx" ON "Movie"("title");

-- CreateIndex
CREATE INDEX "Movie_year_idx" ON "Movie"("year");

-- CreateIndex
CREATE INDEX "Movie_watched_idx" ON "Movie"("watched");

-- CreateIndex
CREATE INDEX "Movie_favorite_idx" ON "Movie"("favorite");

-- CreateIndex
CREATE INDEX "Movie_watchlist_watchlistAddedAt_idx" ON "Movie"("watchlist", "watchlistAddedAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "UserMovie_userId_idx" ON "UserMovie"("userId");

-- CreateIndex
CREATE INDEX "UserMovie_movieId_idx" ON "UserMovie"("movieId");

-- CreateIndex
CREATE INDEX "UserMovie_watched_idx" ON "UserMovie"("watched");

-- CreateIndex
CREATE INDEX "UserMovie_favorite_idx" ON "UserMovie"("favorite");

-- CreateIndex
CREATE INDEX "UserMovie_watchlist_watchlistAddedAt_idx" ON "UserMovie"("watchlist", "watchlistAddedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserMovie_userId_favoriteRank_key" ON "UserMovie"("userId", "favoriteRank");

-- CreateIndex
CREATE UNIQUE INDEX "LogEntry_sourceKey_key" ON "LogEntry"("sourceKey");

-- CreateIndex
CREATE UNIQUE INDEX "LogEntry_dedupeKey_key" ON "LogEntry"("dedupeKey");

-- CreateIndex
CREATE INDEX "LogEntry_watchedAt_idx" ON "LogEntry"("watchedAt");

-- CreateIndex
CREATE INDEX "LogEntry_movieId_idx" ON "LogEntry"("movieId");

-- CreateIndex
CREATE INDEX "LogEntry_movieId_watchedAt_idx" ON "LogEntry"("movieId", "watchedAt");

-- CreateIndex
CREATE INDEX "LogEntry_sourceUri_idx" ON "LogEntry"("sourceUri");

-- CreateIndex
CREATE INDEX "LogEntry_userId_idx" ON "LogEntry"("userId");

-- AddForeignKey
ALTER TABLE "UserMovie" ADD CONSTRAINT "UserMovie_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMovie" ADD CONSTRAINT "UserMovie_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogEntry" ADD CONSTRAINT "LogEntry_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogEntry" ADD CONSTRAINT "LogEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

