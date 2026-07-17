import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { prisma } from "@/lib/prisma";
import { getOwnerUser } from "../src/lib/auth";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(rootDirectory, ".env.local") });
config({ path: path.join(rootDirectory, ".env") });

export async function backfillCollections() {
  const owner = await getOwnerUser();
  const ownerId = owner?.id || "";
  if (!ownerId) {
    console.log("No owner user found to backfill collections.");
    return;
  }

  const watchlistResult = await prisma.userMovie.updateMany({
    where: { userId: ownerId, watchlist: true, watchlistAddedAt: null },
    data: { watchlistAddedAt: new Date() },
  });

  const [rankedMovies, favoriteLogs] = await Promise.all([
    prisma.userMovie.findMany({ where: { userId: ownerId, favoriteRank: { not: null } }, select: { favoriteRank: true } }),
    prisma.logEntry.findMany({ where: { userId: ownerId, favorite: true }, orderBy: [{ watchedAt: "desc" }, { loggedAt: "desc" }], select: { movieId: true } }),
  ]);
  const usedRanks = new Set(rankedMovies.map((movie) => movie.favoriteRank));
  const availableRanks = Array.from({ length: 10 }, (_, index) => index + 1).filter((rank) => !usedRanks.has(rank));
  const uniqueMovieIds = [...new Set(favoriteLogs.map((log) => log.movieId))];
  
  if (uniqueMovieIds.length) {
    for (const movieId of uniqueMovieIds) {
      await prisma.userMovie.upsert({
        where: { userId_movieId: { userId: ownerId, movieId } },
        create: { userId: ownerId, movieId, favorite: true },
        update: { favorite: true }
      });
    }
  }
  
  let addedFavorites = 0;

  for (const movieId of uniqueMovieIds) {
    const rank = availableRanks.shift();
    if (!rank) break;
    const userMovie = await prisma.userMovie.findUnique({
      where: { userId_movieId: { userId: ownerId, movieId } },
      select: { favoriteRank: true }
    });
    if (!userMovie || userMovie.favoriteRank != null) continue;
    await prisma.userMovie.update({
      where: { userId_movieId: { userId: ownerId, movieId } },
      data: { favoriteRank: rank }
    });
    addedFavorites += 1;
  }

  console.log(`Collection backfill complete: timestamped ${watchlistResult.count} watchlist movies and ranked ${addedFavorites} favorites.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  backfillCollections()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
