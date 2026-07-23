import type { Movie } from "@prisma/client";

/** Estado do filme para cada usuário, armazenado em `UserMovie`. */
export type UserMovieState = {
  rating: number | null;
  watched: boolean;
  favorite: boolean;
  watchlist: boolean;
  watchlistAddedAt: Date | null;
  favoriteRank: number | null;
};

/** Filme do catálogo com o estado opcional do usuário atual. */
export type EnrichedMovie = Movie & Partial<UserMovieState>;

/** Formato mínimo e serializável usado pelos cartões de filme. */
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
