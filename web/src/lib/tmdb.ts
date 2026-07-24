/** Tipos do TMDB e montagem de URLs de imagem — as chamadas à API do TMDB vivem no backend. */

export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

export type TmdbMovieSearchResult = {
  id: number;
  title: string;
  original_title?: string;
  release_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  genre_ids?: number[];
};

export type TmdbGenre = { id: number; name: string };

export type TmdbMovieDetails = TmdbMovieSearchResult & {
  tagline?: string;
  runtime?: number | null;
  original_language?: string;
  genres?: Array<{ id: number; name: string }>;
  production_countries?: Array<{ iso_3166_1: string; name: string }>;
  production_companies?: Array<{ id: number; name: string }>;
  keywords?: { keywords: Array<{ id: number; name: string }> };
  external_ids?: { imdb_id?: string | null };
  images?: { posters: TmdbPoster[]; backdrops: TmdbPoster[] };
  credits?: {
    crew: Array<{ id: number; name: string; job: string; department: string }>;
    cast: Array<{ id: number; name: string; character?: string; order: number; profile_path?: string | null }>;
  };
};

export type TmdbPoster = {
  file_path: string;
  width: number;
  height: number;
  aspect_ratio: number;
  vote_average: number;
  vote_count: number;
  iso_639_1?: string | null;
};

export type TmdbSearchResponse = {
  page: number;
  total_pages: number;
  total_results: number;
  results: TmdbMovieSearchResult[];
};

export type TmdbPersonSearchResult = {
  id: number;
  name: string;
  known_for_department?: string;
  popularity?: number;
  profile_path?: string | null;
  known_for?: Array<{ title?: string; name?: string; media_type?: string }>;
};

export type TmdbFeed = "trending" | "popular" | "now-playing" | "top-rated" | "upcoming";

/** Ignora valores vazios ou serializados como texto ("null"/"undefined"). */
function cleanArtworkPath(path: string | null | undefined): string | null {
  const cleaned = path?.trim();
  return cleaned && cleaned !== "null" && cleaned !== "undefined" ? cleaned : null;
}

export function moviePosterPath(movie: { posterPath: string | null; preferredPosterPath?: string | null }): string | null {
  return cleanArtworkPath(movie.preferredPosterPath) ?? cleanArtworkPath(movie.posterPath);
}

export function movieBackdropPath(movie: { backdropPath: string | null; preferredBackdropPath?: string | null }): string | null {
  return cleanArtworkPath(movie.preferredBackdropPath) ?? cleanArtworkPath(movie.backdropPath);
}

export function getPosterUrl(path: string | null | undefined): string | null {
  const cleaned = cleanArtworkPath(path);
  if (!cleaned) return null;
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  return `${TMDB_IMAGE_BASE}${cleaned.startsWith("/") ? cleaned : `/${cleaned}`}`;
}

export function getBackdropUrl(path: string | null | undefined): string | null {
  const cleaned = cleanArtworkPath(path);
  if (!cleaned) return null;
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  return `https://image.tmdb.org/t/p/w1280${cleaned.startsWith("/") ? cleaned : `/${cleaned}`}`;
}
