/** Tipos das respostas da API consumidas pelas páginas (o cálculo vive no backend). */

import type { CardMovie } from "./types";
import type { DiaryItem } from "@/components/DiaryExplorer";

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

export type DiaryData = { entries: DiaryItem[]; reviews: number; rewatches: number };

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
