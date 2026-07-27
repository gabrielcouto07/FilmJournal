import type { Movie } from "@prisma/client";

/** Estado por usuário, gravado em `UserMovie`. */
export type UserMovieState = {
  rating: number | null;
  watched: boolean;
  favorite: boolean;
  watchlist: boolean;
  watchlistAddedAt: Date | null;
  favoriteRank: number | null;
};

export type EnrichedMovie = Movie & Partial<UserMovieState>;

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
