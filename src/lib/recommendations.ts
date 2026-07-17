import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  discoverTmdbMovies,
  getTmdbMovieRecommendations,
  getTmdbPersonDirectedMovies,
  searchTmdbPerson,
  type TmdbMovieSearchResult,
} from "@/lib/tmdb";

const RECOMMENDATION_TTL_SECONDS = 21_600;
const GENRE_IDS: Record<string, number> = {
  Action: 28, Adventure: 12, Animation: 16, Comedy: 35, Crime: 80,
  Documentary: 99, Drama: 18, Family: 10751, Fantasy: 14, History: 36,
  Horror: 27, Music: 10402, Mystery: 9648, Romance: 10749,
  "Science Fiction": 878, Thriller: 53, War: 10752, Western: 37,
};

export type ExistingRecommendationMovie = {
  id: string;
  watchlist: boolean;
  favorite: boolean;
};

export type TasteRecommendation = {
  tmdbId: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  preferredPosterPath: string | null;
  overview: string | null;
  tmdbRating: number | null;
  reason: string;
  existing: ExistingRecommendationMovie | null;
};

export type TasteDirector = {
  name: string;
  watchedCount: number;
  averageRating: number | null;
  favoriteCount: number;
  reason: string;
  films: TasteRecommendation[];
};

export type TasteBlindSpot = {
  id: string;
  title: string;
  year: number | null;
  rating: number;
  posterPath: string | null;
  preferredPosterPath: string | null;
};

export type TasteData = {
  generatedAt: string;
  cacheTtlHours: number;
  profile: {
    watchedFilms: number;
    ratedFilms: number;
    reviewedFilms: number;
    favoriteDecade: string | null;
    topGenres: Array<{ name: string; count: number; averageRating: number | null }>;
  };
  becauseYouLoved: TasteRecommendation[];
  directors: TasteDirector[];
  genreDiscovery: TasteRecommendation[];
  genreDiscoveryLabel: string;
  blindSpots: TasteBlindSpot[];
};

type ArchiveMovie = Awaited<ReturnType<typeof loadArchive>>[number];

async function loadArchive(userId: string) {
  const [movies, userMovies] = await Promise.all([
    prisma.movie.findMany({
      select: {
        id: true, tmdbId: true, title: true, year: true, posterPath: true, preferredPosterPath: true,
        genres: true, directors: true,
        logs: { where: { userId }, select: { rating: true, review: true } },
      },
    }),
    prisma.userMovie.findMany({
      where: { userId }
    })
  ]);

  const umMap = new Map(userMovies.map(um => [um.movieId, um]));
  return movies.map(movie => {
    const um = umMap.get(movie.id);
    return {
      ...movie,
      rating: um?.rating ?? null,
      watched: um?.watched ?? false,
      favorite: um?.favorite ?? false,
      favoriteRank: um?.favoriteRank ?? null,
      watchlist: um?.watchlist ?? false,
      logs: movie.logs,
    };
  });
}

function splitList(value: string | null) {
  return value?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];
}

function effectiveRating(movie: ArchiveMovie) {
  if (movie.rating != null) return movie.rating;
  const ratings = movie.logs.flatMap((log) => log.rating == null ? [] : [log.rating]);
  return ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null;
}

function isWatched(movie: ArchiveMovie) {
  return movie.watched || movie.logs.length > 0;
}

function toRecommendation(movie: TmdbMovieSearchResult, reason: string, archiveByTmdbId: Map<number, ArchiveMovie>): TasteRecommendation {
  const existing = archiveByTmdbId.get(movie.id);
  return {
    tmdbId: movie.id,
    title: movie.title,
    year: movie.release_date ? Number(movie.release_date.slice(0, 4)) || null : null,
    posterPath: movie.poster_path ?? null,
    preferredPosterPath: existing?.preferredPosterPath ?? null,
    overview: movie.overview?.trim() || null,
    tmdbRating: movie.vote_average ?? null,
    reason,
    existing: existing ? { id: existing.id, watchlist: existing.watchlist, favorite: existing.favorite } : null,
  };
}

function uniqueRecommendations(items: TasteRecommendation[], excluded = new Set<number>(), limit = 10) {
  const unique = new Map<number, TasteRecommendation>();
  for (const item of items) {
    if (!excluded.has(item.tmdbId) && !unique.has(item.tmdbId)) unique.set(item.tmdbId, item);
    if (unique.size === limit) break;
  }
  return [...unique.values()];
}

async function buildTasteData(refresh: boolean, userId: string): Promise<TasteData> {
  const archive = await loadArchive(userId);
  const watched = archive.filter(isWatched);
  const watchedTmdbIds = new Set(watched.flatMap((movie) => movie.tmdbId == null ? [] : [movie.tmdbId]));
  const archiveByTmdbId = new Map(archive.flatMap((movie) => movie.tmdbId == null ? [] : [[movie.tmdbId, movie] as const]));

  const genreStats = new Map<string, { count: number; score: number; ratingTotal: number; ratingCount: number }>();
  const directorStats = new Map<string, { movies: ArchiveMovie[]; score: number; ratingTotal: number; ratingCount: number; favorites: number }>();
  const decadeStats = new Map<number, number>();

  for (const movie of watched) {
    const rating = effectiveRating(movie);
    const tasteWeight = 1 + Math.max(0, (rating ?? 2.5) - 2.5) * .8 + (movie.favorite ? 1.5 : 0) + (movie.favoriteRank != null ? 1.5 : 0);
    for (const genre of splitList(movie.genres)) {
      const stat = genreStats.get(genre) ?? { count: 0, score: 0, ratingTotal: 0, ratingCount: 0 };
      stat.count += 1; stat.score += tasteWeight;
      if (rating != null) { stat.ratingTotal += rating; stat.ratingCount += 1; }
      genreStats.set(genre, stat);
    }
    for (const director of splitList(movie.directors)) {
      const stat = directorStats.get(director) ?? { movies: [], score: 0, ratingTotal: 0, ratingCount: 0, favorites: 0 };
      stat.movies.push(movie); stat.score += tasteWeight;
      if (rating != null) { stat.ratingTotal += rating; stat.ratingCount += 1; }
      if (movie.favorite || movie.favoriteRank != null) stat.favorites += 1;
      directorStats.set(director, stat);
    }
    if (movie.year) {
      const decade = Math.floor(movie.year / 10) * 10;
      decadeStats.set(decade, (decadeStats.get(decade) ?? 0) + tasteWeight);
    }
  }

  const topGenres = [...genreStats.entries()].sort((left, right) => right[1].score - left[1].score).slice(0, 5);
  const topDirectors = [...directorStats.entries()].sort((left, right) => {
    const leftAverage = left[1].ratingCount ? left[1].ratingTotal / left[1].ratingCount : 0;
    const rightAverage = right[1].ratingCount ? right[1].ratingTotal / right[1].ratingCount : 0;
    return (right[1].score + rightAverage + right[1].favorites * 2) - (left[1].score + leftAverage + left[1].favorites * 2);
  }).slice(0, 3);
  const ratedSeeds = watched.filter((movie) => movie.tmdbId != null && (effectiveRating(movie) ?? 0) >= 4)
    .sort((left, right) => ((effectiveRating(right) ?? 0) + (right.favorite ? 1 : 0)) - ((effectiveRating(left) ?? 0) + (left.favorite ? 1 : 0)))
    .slice(0, 3);

  const genreIds = topGenres.flatMap(([genre]) => GENRE_IDS[genre] ? [GENRE_IDS[genre]] : []).slice(0, 3);
  const [seedResults, directorResults, genreResult] = await Promise.all([
    Promise.all(ratedSeeds.map(async (seed) => {
      try {
        const response = await getTmdbMovieRecommendations(seed.tmdbId!, refresh);
        return response.results.map((movie) => ({ movie, reason: `Because you rated ${seed.title} ${(effectiveRating(seed) ?? 0).toFixed(1)}` }));
      } catch { return []; }
    })),
    Promise.all(topDirectors.map(async ([name, stat]) => {
      try {
        const person = await searchTmdbPerson(name, refresh);
        if (!person) return { name, stat, movies: [] as TmdbMovieSearchResult[] };
        const movies = await getTmdbPersonDirectedMovies(person.id, refresh);
        return { name, stat, movies: movies.filter((movie) => (movie.vote_count ?? 0) >= 50) };
      } catch { return { name, stat, movies: [] as TmdbMovieSearchResult[] }; }
    })),
    genreIds.length ? discoverTmdbMovies({
      with_genres: genreIds.join("|"), sort_by: "vote_average.desc", "vote_count.gte": "350",
    }, refresh).catch(() => ({ page: 1, total_pages: 0, total_results: 0, results: [] })) : Promise.resolve({ page: 1, total_pages: 0, total_results: 0, results: [] }),
  ]);

  const becauseYouLoved = uniqueRecommendations(seedResults.flat().map(({ movie, reason }) => toRecommendation(movie, reason, archiveByTmdbId)), watchedTmdbIds, 12);
  const alreadyCurated = new Set(becauseYouLoved.map((movie) => movie.tmdbId));
  const directors: TasteDirector[] = directorResults.map(({ name, stat, movies }) => {
    const averageRating = stat.ratingCount ? stat.ratingTotal / stat.ratingCount : null;
    const reason = stat.favorites
      ? `${stat.favorites} favorite${stat.favorites === 1 ? "" : "s"} in your archive`
      : averageRating != null ? `You average ${averageRating.toFixed(1)} across their films` : "A recurring voice in your archive";
    const films = uniqueRecommendations(movies.map((movie) => toRecommendation(movie, `More from ${name}`, archiveByTmdbId)), new Set([...watchedTmdbIds, ...alreadyCurated]), 6);
    films.forEach((film) => alreadyCurated.add(film.tmdbId));
    return { name, watchedCount: stat.movies.length, averageRating, favoriteCount: stat.favorites, reason, films };
  });

  const discoveryGenreNames = topGenres.slice(0, 3).map(([name]) => name);
  const genreDiscovery = uniqueRecommendations(genreResult.results.map((movie) => toRecommendation(
    movie,
    discoveryGenreNames.length ? `Matches your ${discoveryGenreNames.join(" + ")} pattern` : "Aligned with your archive",
    archiveByTmdbId,
  )), new Set([...watchedTmdbIds, ...alreadyCurated]), 12);

  const blindSpots = watched.filter((movie) => {
    const rating = effectiveRating(movie);
    return rating != null && rating >= 4 && !movie.logs.some((log) => log.review?.trim());
  }).sort((left, right) => (effectiveRating(right) ?? 0) - (effectiveRating(left) ?? 0)).slice(0, 8).map((movie) => ({
    id: movie.id, title: movie.title, year: movie.year, rating: effectiveRating(movie)!,
    posterPath: movie.posterPath, preferredPosterPath: movie.preferredPosterPath,
  }));

  const favoriteDecade = [...decadeStats.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
  return {
    generatedAt: new Date().toISOString(),
    cacheTtlHours: RECOMMENDATION_TTL_SECONDS / 3600,
    profile: {
      watchedFilms: watched.length,
      ratedFilms: watched.filter((movie) => effectiveRating(movie) != null).length,
      reviewedFilms: watched.filter((movie) => movie.logs.some((log) => log.review?.trim())).length,
      favoriteDecade: favoriteDecade == null ? null : `${favoriteDecade}s`,
      topGenres: topGenres.map(([name, stat]) => ({
        name, count: stat.count, averageRating: stat.ratingCount ? stat.ratingTotal / stat.ratingCount : null,
      })),
    },
    becauseYouLoved,
    directors,
    genreDiscovery,
    genreDiscoveryLabel: discoveryGenreNames.join(" · ") || "Your archive mix",
    blindSpots,
  };
}

const getCachedTasteData = unstable_cache(
  async (_archiveFingerprint: string, userId: string) => buildTasteData(false, userId),
  ["filmjournal-taste-v2"],
  { revalidate: RECOMMENDATION_TTL_SECONDS },
);

async function archiveFingerprint(userId: string) {
  const [movieCount, logCount, latestMovie, latestLog] = await Promise.all([
    prisma.movie.count(), prisma.logEntry.count({ where: { userId } }),
    prisma.movie.findFirst({ orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
    prisma.logEntry.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
  ]);
  return `${movieCount}:${logCount}:${latestMovie?.updatedAt.toISOString() ?? "none"}:${latestLog?.updatedAt.toISOString() ?? "none"}:${userId}`;
}

export async function getTasteData({ refresh = false, userId }: { refresh?: boolean; userId: string }) {
  if (refresh) return buildTasteData(true, userId);
  return getCachedTasteData(await archiveFingerprint(userId), userId);
}
