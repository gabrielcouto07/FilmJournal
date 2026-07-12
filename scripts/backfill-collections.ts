import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { prisma } from "@/lib/prisma";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(rootDirectory, ".env.local") });
config({ path: path.join(rootDirectory, ".env") });

export async function backfillCollections() {
  const watchlistResult = await prisma.movie.updateMany({
    where: { watchlist: true, watchlistAddedAt: null },
    data: { watchlistAddedAt: new Date() },
  });

  const [rankedMovies, favoriteLogs] = await Promise.all([
    prisma.movie.findMany({ where: { favoriteRank: { not: null } }, select: { favoriteRank: true } }),
    prisma.logEntry.findMany({ where: { favorite: true }, orderBy: [{ watchedAt: "desc" }, { loggedAt: "desc" }], select: { movieId: true } }),
  ]);
  const usedRanks = new Set(rankedMovies.map((movie) => movie.favoriteRank));
  const availableRanks = Array.from({ length: 10 }, (_, index) => index + 1).filter((rank) => !usedRanks.has(rank));
  const uniqueMovieIds = [...new Set(favoriteLogs.map((log) => log.movieId))];
  let addedFavorites = 0;

  for (const movieId of uniqueMovieIds) {
    const rank = availableRanks.shift();
    if (!rank) break;
    const movie = await prisma.movie.findUnique({ where: { id: movieId }, select: { favoriteRank: true } });
    if (!movie || movie.favoriteRank != null) continue;
    await prisma.movie.update({ where: { id: movieId }, data: { favoriteRank: rank } });
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
