/** Tipos da resposta de GET /recommendations (a curadoria é calculada no backend). */

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
