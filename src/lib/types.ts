import type { Movie } from "@prisma/client";

/**
 * Per-user collection state. Since the multi-user migration, this lives on
 * `UserMovie` (not on the shared catalog `Movie`). Server pages/routes layer it
 * onto a `Movie` before handing it to the UI.
 */
export type UserMovieState = {
  rating: number | null;
  watched: boolean;
  favorite: boolean;
  watchlist: boolean;
  watchlistAddedAt: Date | null;
  favoriteRank: number | null;
};

/**
 * A shared catalog `Movie` enriched with the viewing user's per-movie state.
 * The state fields are optional so a bare catalog `Movie` is still assignable.
 */
export type EnrichedMovie = Movie & Partial<UserMovieState>;
