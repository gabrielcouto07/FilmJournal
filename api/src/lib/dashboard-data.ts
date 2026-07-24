import type { Movie } from "@prisma/client";
import { unstableCache } from "./cache.js";
import { prisma } from "./prisma.js";
import { computePalate, type Palate, type PalateFilm } from "./analytics/palate.js";
import { computeTimeline, type Timeline, type TimelineEntry } from "./analytics/timeline.js";
import { computeMotifSummary, type MotifFilm, type MotifSummary } from "./analytics/motifs.js";
import type { CardMovie } from "./types.js";

/** Camada de leitura das rotas dashboard/diary/watchlist/favorites/stats, com cache por etiquetas. */
export const CATALOG_TAG = "catalog";
export const userTag = (userId: string) => `user:${userId}`;
const REVALIDATE_SECONDS = 300;

/** Shares cache config and logs HIT/MISS for diagnostics. */
function timedRead<T>(label: string, version: string, userId: string, compute: () => Promise<T>): Promise<T> {
  const start = performance.now();
  let computeMs: number | null = null;
  return unstableCache(
    async (): Promise<T> => {
      const computeStart = performance.now();
      const value = await compute();
      computeMs = performance.now() - computeStart;
      return value;
    },
    [version, userId],
    { revalidate: REVALIDATE_SECONDS, tags: [userTag(userId), CATALOG_TAG] },
  )().then((value) => {
    const total = Math.round(performance.now() - start);
    console.log(
      computeMs === null
        ? `[data] ${label} HIT ${total}ms`
        : `[data] ${label} MISS ${total}ms (compute ${Math.round(computeMs)}ms)`,
    );
    return value;
  });
}

type UserState = {
  rating: number | null;
  watched: boolean;
  favorite: boolean;
  watchlist: boolean;
  watchlistAddedAt: Date | null;
  favoriteRank: number | null;
};

function toCard(movie: Movie, um?: UserState | null): CardMovie {
  return {
    id: movie.id,
    title: movie.title,
    year: movie.year,
    posterPath: movie.posterPath,
    preferredPosterPath: movie.preferredPosterPath,
    rating: um?.rating ?? null,
    watched: um?.watched ?? false,
    favorite: um?.favorite ?? false,
    watchlist: um?.watchlist ?? false,
    favoriteRank: um?.favoriteRank ?? null,
  };
}

// Home page

export type DashboardData = {
  featured: null | {
    filmId: string;
    review: string | null;
    rating: number | null;
    movie: CardMovie & {
      runtime: number | null;
      genres: string | null;
      overview: string | null;
      backdropPath: string | null;
      preferredBackdropPath: string | null;
    };
  };
  recent: Array<{ log: { id: string; rating: number | null; rewatch: boolean }; movie: CardMovie }>;
  logCount: number;
  watchedCount: number;
  reviewCount: number;
  rewatchCount: number;
  favorites: CardMovie[];
  watchlist: Array<{ id: string; title: string; year: number | null }>;
  topRated: CardMovie[];
  months: Array<{ label: string; value: number }>;
  yearWatches: number;
};

export function getDashboardData(userId: string): Promise<DashboardData> {
  return timedRead("dashboard", "dashboard-v1", userId, async (): Promise<DashboardData> => {
      const since = new Date();
      since.setUTCMonth(since.getUTCMonth() - 11, 1);
      since.setUTCHours(0, 0, 0, 0);
      const yearStart = new Date(`${new Date().getUTCFullYear()}-01-01T00:00:00.000Z`);

      const [rawLogs, logCount, watchedCount, reviewCount, rewatchCount, rawFavorites, rawWatchlist, rawTopRated, patternLogs, yearWatches] = await Promise.all([
        prisma.logEntry.findMany({
          where: { userId },
          include: { movie: { include: { userMovies: { where: { userId } } } } },
          orderBy: [{ watchedAt: "desc" }, { loggedAt: "desc" }],
          take: 10,
        }),
        prisma.logEntry.count({ where: { userId } }),
        prisma.userMovie.count({ where: { userId, watched: true } }),
        prisma.logEntry.count({ where: { userId, review: { not: null } } }),
        prisma.logEntry.count({ where: { userId, rewatch: true } }),
        prisma.userMovie.findMany({ where: { userId, favorite: true }, include: { movie: true }, orderBy: [{ favoriteRank: "asc" }, { rating: "desc" }, { updatedAt: "desc" }], take: 7 }),
        prisma.userMovie.findMany({ where: { userId, watchlist: true }, include: { movie: true }, orderBy: [{ watchlistAddedAt: "desc" }, { updatedAt: "desc" }], take: 7 }),
        prisma.userMovie.findMany({ where: { userId, rating: { not: null } }, include: { movie: true }, orderBy: [{ rating: "desc" }, { updatedAt: "desc" }], take: 7 }),
        prisma.logEntry.findMany({ where: { userId, watchedAt: { gte: since } }, select: { watchedAt: true, loggedAt: true } }),
        prisma.logEntry.count({ where: { userId, watchedAt: { gte: yearStart } } }),
      ]);

      const monthCounts = new Map<string, number>();
      patternLogs.forEach((log) => {
        const date = log.watchedAt ?? log.loggedAt;
        if (date) {
          const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
          monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
        }
      });
      const months = Array.from({ length: 12 }, (_, offset) => {
        const date = new Date();
        date.setUTCDate(1);
        date.setUTCMonth(date.getUTCMonth() - (11 - offset));
        const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
        return { label: new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date), value: monthCounts.get(key) ?? 0 };
      });

      const first = rawLogs[0];
      const featured = first
        ? {
            filmId: first.movie.id,
            review: first.review,
            rating: first.rating ?? first.movie.userMovies[0]?.rating ?? null,
            movie: {
              ...toCard(first.movie, first.movie.userMovies[0]),
              runtime: first.movie.runtime,
              genres: first.movie.genres,
              overview: first.movie.overview,
              backdropPath: first.movie.backdropPath,
              preferredBackdropPath: first.movie.preferredBackdropPath,
            },
          }
        : null;

      return {
        featured,
        recent: rawLogs.map((log) => ({
          log: { id: log.id, rating: log.rating, rewatch: log.rewatch },
          movie: toCard(log.movie, log.movie.userMovies[0]),
        })),
        logCount,
        watchedCount,
        reviewCount,
        rewatchCount,
        favorites: rawFavorites.map((um) => toCard(um.movie, um)),
        watchlist: rawWatchlist.map((um) => ({ id: um.movie.id, title: um.movie.title, year: um.movie.year })),
        topRated: rawTopRated.map((um) => toCard(um.movie, um)),
        months,
        yearWatches,
      };
  });
}

// Diary

export type DiaryItem = {
  id: string;
  watchedAt: string | null;
  loggedAt: string | null;
  rating: number | null;
  review: string | null;
  rewatch: boolean;
  tags: string | null;
  movie: { id: string; title: string; year: number | null; genres: string | null; posterPath: string | null; preferredPosterPath: string | null; favorite: boolean };
};

export type DiaryData = { entries: DiaryItem[]; reviews: number; rewatches: number };

export function getDiaryData(userId: string): Promise<DiaryData> {
  return timedRead("diary", "diary-v1", userId, async (): Promise<DiaryData> => {
      const logs = await prisma.logEntry.findMany({
        where: { userId },
        include: {
          movie: {
            select: {
              id: true, title: true, year: true, genres: true, posterPath: true, preferredPosterPath: true,
              userMovies: { where: { userId }, select: { favorite: true } },
            },
          },
        },
        orderBy: [{ watchedAt: "desc" }, { loggedAt: "desc" }],
      });

      const entries: DiaryItem[] = logs.map((log) => ({
        id: log.id,
        watchedAt: log.watchedAt?.toISOString() ?? null,
        loggedAt: log.loggedAt?.toISOString() ?? null,
        rating: log.rating,
        review: log.review,
        rewatch: log.rewatch,
        tags: log.tags,
        movie: {
          id: log.movie.id,
          title: log.movie.title,
          year: log.movie.year,
          genres: log.movie.genres,
          posterPath: log.movie.posterPath,
          preferredPosterPath: log.movie.preferredPosterPath,
          favorite: log.movie.userMovies[0]?.favorite ?? false,
        },
      }));

      return {
        entries,
        reviews: logs.filter((log) => log.review?.trim()).length,
        rewatches: logs.filter((log) => log.rewatch).length,
      };
  });
}

// Watchlist

export type WatchlistMovie = {
  id: string; title: string; year: number | null; releaseDate: string | null; runtime: number | null;
  genres: string | null; overview: string | null; posterPath: string | null; preferredPosterPath: string | null;
  watchlistAddedAt: string | null; tmdbRating: number | null;
};

export function getWatchlistData(userId: string): Promise<WatchlistMovie[]> {
  return timedRead("watchlist", "watchlist-v1", userId, async (): Promise<WatchlistMovie[]> => {
      const userMovies = await prisma.userMovie.findMany({
        where: { userId, watchlist: true },
        include: { movie: true },
        orderBy: [{ watchlistAddedAt: "desc" }, { updatedAt: "desc" }],
      });
      return userMovies.map((um) => ({
        id: um.movie.id,
        title: um.movie.title,
        year: um.movie.year,
        releaseDate: um.movie.releaseDate?.toISOString() ?? null,
        runtime: um.movie.runtime,
        genres: um.movie.genres,
        overview: um.movie.overview,
        posterPath: um.movie.posterPath,
        preferredPosterPath: um.movie.preferredPosterPath,
        watchlistAddedAt: um.watchlistAddedAt?.toISOString() ?? null,
        tmdbRating: um.movie.tmdbRating,
      }));
  });
}

// Favorites

export type FavoriteMovie = { id: string; title: string; year: number | null; posterPath: string | null; preferredPosterPath: string | null; favoriteRank: number | null; favorite: boolean; genres: string | null };

export function getFavoritesData(userId: string): Promise<FavoriteMovie[]> {
  return timedRead("favorites", "favorites-v1", userId, async (): Promise<FavoriteMovie[]> => {
      const userMovies = await prisma.userMovie.findMany({
        where: { userId, OR: [{ favorite: true }, { favoriteRank: { not: null } }] },
        include: { movie: true },
        orderBy: [{ favoriteRank: "asc" }],
      });
      const movies: FavoriteMovie[] = userMovies.map((um) => ({
        id: um.movie.id,
        title: um.movie.title,
        year: um.movie.year,
        posterPath: um.movie.posterPath,
        preferredPosterPath: um.movie.preferredPosterPath,
        favoriteRank: um.favoriteRank,
        favorite: um.favorite,
        genres: um.movie.genres,
      }));
      // Ranked favorites come first; the rest are alphabetical.
      movies.sort((a, b) => {
        if (a.favoriteRank !== null && b.favoriteRank !== null) return a.favoriteRank - b.favoriteRank;
        if (a.favoriteRank !== null) return -1;
        if (b.favoriteRank !== null) return 1;
        return a.title.localeCompare(b.title);
      });
      return movies;
  });
}

// Stats

export type StatsData = {
  sessions: number;
  watchedCount: number;
  average: number | null;
  reviews: number;
  rewatches: number;
  ratedCount: number;
  distribution: Array<{ rating: number; count: number }>;
  maxRating: number;
  monthSeries: Array<{ key: string; count: number }>;
  maxMonth: number;
  retro: {
    year: number;
    sessions: number;
    average: number | null;
    reviews: number;
    topGenre: string | null;
    topDirector: string | null;
    busiestMonth: string | null;
  };
};

function countValues(values: Array<string | null>): Array<[string, number]> {
  const map = new Map<string, number>();
  values
    .flatMap((value) => value?.split(",").map((item) => item.trim()).filter(Boolean) ?? [])
    .forEach((value) => map.set(value, (map.get(value) ?? 0) + 1));
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

export function getStatsData(userId: string): Promise<StatsData> {
  // Genres, directors, and top ratings are now computed by Palate.
  return timedRead("stats", "stats-v2", userId, async (): Promise<StatsData> => {
      const currentYear = new Date().getUTCFullYear();
      const yearStart = new Date(Date.UTC(currentYear, 0, 1));

      const [logs, watchedCount, yearLogs] = await Promise.all([
        // These charts only use log-entry fields.
        prisma.logEntry.findMany({
          where: { userId },
          select: { rating: true, review: true, rewatch: true, watchedAt: true, loggedAt: true },
          orderBy: { watchedAt: "asc" },
        }),
        prisma.userMovie.count({ where: { userId, watched: true } }),
        prisma.logEntry.findMany({
          where: { userId, OR: [{ watchedAt: { gte: yearStart } }, { watchedAt: null, loggedAt: { gte: yearStart } }] },
          select: { rating: true, review: true, watchedAt: true, loggedAt: true, movie: { select: { genres: true, directors: true } } },
        }),
      ]);

      const rated = logs.filter((log) => log.rating != null);
      const average = rated.length ? rated.reduce((sum, log) => sum + (log.rating ?? 0), 0) / rated.length : null;
      const distribution = Array.from({ length: 10 }, (_, index) => {
        const rating = (index + 1) / 2;
        return { rating, count: rated.filter((log) => log.rating === rating).length };
      });

      const months = new Map<string, number>();
      logs.forEach((log) => {
        const date = log.watchedAt ?? log.loggedAt;
        if (date) {
          const key = date.toISOString().slice(0, 7);
          months.set(key, (months.get(key) ?? 0) + 1);
        }
      });
      const monthSeries = [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-18).map(([key, count]) => ({ key, count }));

      // Year in review.
      const yearRated = yearLogs.filter((log) => log.rating != null);
      const yearMonths = new Map<string, number>();
      yearLogs.forEach((log) => {
        const date = log.watchedAt ?? log.loggedAt;
        if (date) {
          const label = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(date);
          yearMonths.set(label, (yearMonths.get(label) ?? 0) + 1);
        }
      });
      const retro = {
        year: currentYear,
        sessions: yearLogs.length,
        average: yearRated.length ? yearRated.reduce((sum, log) => sum + (log.rating ?? 0), 0) / yearRated.length : null,
        reviews: yearLogs.filter((log) => log.review?.trim()).length,
        topGenre: countValues(yearLogs.map((log) => log.movie.genres))[0]?.[0] ?? null,
        topDirector: countValues(yearLogs.map((log) => log.movie.directors))[0]?.[0] ?? null,
        busiestMonth: [...yearMonths.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
      };

      return {
        sessions: logs.length,
        watchedCount,
        average,
        reviews: logs.filter((log) => log.review?.trim()).length,
        rewatches: logs.filter((log) => log.rewatch).length,
        ratedCount: rated.length,
        distribution,
        maxRating: Math.max(1, ...distribution.map((item) => item.count)),
        monthSeries,
        maxMonth: Math.max(1, ...monthSeries.map((item) => item.count)),
        retro,
      };
  });
}

// Palate

/** Loads rated films and hands the calculations off to the pure Palate module. */
export function getPalateData(userId: string): Promise<Palate> {
  return timedRead("palate", "palate-v1", userId, async (): Promise<Palate> => {
      const rows = await prisma.userMovie.findMany({
        where: { userId, rating: { not: null } },
        select: {
          rating: true,
          movie: {
            select: {
              id: true, title: true, year: true, runtime: true,
              tmdbRating: true, tmdbVoteCount: true, countries: true,
              directorId: true, directorName: true,
              genreList: { select: { name: true } },
            },
          },
        },
      });

      const films: PalateFilm[] = rows.map((row) => ({
        id: row.movie.id,
        title: row.movie.title,
        year: row.movie.year,
        userRating: row.rating as number,
        crowdRating: row.movie.tmdbRating,
        crowdVotes: row.movie.tmdbVoteCount,
        runtime: row.movie.runtime,
        countries: row.movie.countries,
        genres: row.movie.genreList.map((genre) => genre.name),
        directorId: row.movie.directorId,
        directorName: row.movie.directorName,
      }));

      return computePalate(films);
  });
}

// Timeline

/** Loads the diary and computes how taste evolved over time. */
export function getTimelineData(userId: string): Promise<Timeline> {
  return timedRead("timeline", "timeline-v1", userId, async (): Promise<Timeline> => {
      const logs = await prisma.logEntry.findMany({
        where: { userId },
        select: {
          watchedAt: true,
          loggedAt: true,
          rating: true,
          movie: {
            select: {
              year: true, tmdbRating: true, tmdbVoteCount: true,
              genreList: { select: { name: true } },
            },
          },
        },
      });

      const entries: TimelineEntry[] = logs.map((log) => ({
        watchedAt: log.watchedAt,
        loggedAt: log.loggedAt,
        userRating: log.rating,
        filmYear: log.movie.year,
        crowdRating: log.movie.tmdbRating,
        crowdVotes: log.movie.tmdbVoteCount,
        genres: log.movie.genreList.map((genre) => genre.name),
      }));

      return computeTimeline(entries);
  });
}

// Recurring motifs

/** Summarizes recurring themes across the user's highest-rated films. */
export function getMotifsData(userId: string): Promise<MotifSummary> {
  return timedRead("motifs", "motifs-v1", userId, async (): Promise<MotifSummary> => {
      const rows = await prisma.userMovie.findMany({
        where: { userId, rating: { not: null } },
        select: {
          rating: true,
          movie: { select: { keywords: { select: { name: true } } } },
        },
      });

      const films: MotifFilm[] = rows.map((row) => ({
        userRating: row.rating as number,
        keywords: row.movie.keywords.map((keyword) => keyword.name),
      }));

      return computeMotifSummary(films);
  });
}
