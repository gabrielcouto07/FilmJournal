import type { Movie } from "@prisma/client";

/** Per-user movie state, stored in `UserMovie`. */
export type UserMovieState = {
  rating: number | null;
  watched: boolean;
  favorite: boolean;
  watchlist: boolean;
  watchlistAddedAt: Date | null;
  favoriteRank: number | null;
};

/** Catalog movie with the current user's optional state. */
export type EnrichedMovie = Movie & Partial<UserMovieState>;

/** Minimal, serializable shape used by movie cards. */
export type CardMovie = {
  id: string;
  title: string;
  year: number | null;
  posterPath: string | null;
  preferredPosterPath?: string | null;
  rating?: number | null;
  watched?: boolean;
  favorite?: boolean;
  watchlist?: boolean;
  favoriteRank?: number | null;
};
