/** Tipos da resposta de GET /discover (o cálculo dos pontos cegos vive no backend). */

import type { BlindSpotPick, GapDimension } from "./analytics/blindspots";

export type DiscoverData = {
  totalFilms: number;
  focus: GapDimension | "auto";
  picks: BlindSpotPick[];
  /** Indica que o TMDB não respondeu. */
  degraded: boolean;
};
