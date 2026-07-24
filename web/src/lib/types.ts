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
