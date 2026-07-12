const TMDB_API_BASE = "https://api.themoviedb.org/3";
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
};

export type TmdbMovieDetails = TmdbMovieSearchResult & {
  tagline?: string;
  runtime?: number | null;
  genres?: Array<{ id: number; name: string }>;
  external_ids?: { imdb_id?: string | null };
};

export type TmdbSearchResponse = {
  page: number;
  total_pages: number;
  total_results: number;
  results: TmdbMovieSearchResult[];
};

export class TmdbError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "TmdbError";
  }
}

function getApiKey(): string {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) throw new TmdbError("TMDb is not configured on this server.", 503);
  return apiKey;
}

async function tmdbFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const searchParams = new URLSearchParams({ api_key: getApiKey(), language: "en-US", ...params });

  let response: Response;
  try {
    response = await fetch(`${TMDB_API_BASE}${path}?${searchParams.toString()}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
  } catch (error) {
    const message = error instanceof Error && error.name === "TimeoutError"
      ? "TMDb took too long to respond. Please try again."
      : "Could not reach TMDb. Please check your connection and try again.";
    throw new TmdbError(message, 503);
  }

  if (!response.ok) {
    if (response.status === 401) throw new TmdbError("TMDb rejected the configured API key.", 503);
    if (response.status === 404) throw new TmdbError("The requested TMDb movie was not found.", 404);
    if (response.status === 429) throw new TmdbError("TMDb is rate limiting requests. Please try again shortly.", 429);
    throw new TmdbError("TMDb could not complete this request. Please try again.", 502);
  }

  return response.json() as Promise<T>;
}

export async function searchTmdbMovies(query: string, year?: number, page = 1): Promise<TmdbSearchResponse> {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2) {
    throw new TmdbError("Enter at least two characters to search.", 400);
  }

  const params: Record<string, string> = {
    query: normalizedQuery,
    include_adult: "false",
    page: String(Math.min(Math.max(page, 1), 500)),
  };
  if (year) params.year = String(year);

  const result = await tmdbFetch<TmdbSearchResponse>("/search/movie", params);
  return { ...result, results: result.results.slice(0, 12) };
}

export async function searchTmdbMovie(title: string, year?: number | null): Promise<TmdbMovieSearchResult | null> {
  const result = await searchTmdbMovies(title, year ?? undefined);
  if (result.results[0] || !year) return result.results[0] ?? null;
  return (await searchTmdbMovies(title)).results[0] ?? null;
}

export function getTmdbMovie(tmdbId: number): Promise<TmdbMovieDetails> {
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    throw new TmdbError("A valid TMDb movie id is required.", 400);
  }
  return tmdbFetch<TmdbMovieDetails>(`/movie/${tmdbId}`, { append_to_response: "external_ids" });
}

export function toMovieMetadata(movie: TmdbMovieDetails) {
  return {
    tmdbId: movie.id,
    title: movie.title,
    year: movie.release_date ? Number(movie.release_date.slice(0, 4)) || null : null,
    posterPath: movie.poster_path ?? null,
    backdropPath: movie.backdrop_path ?? null,
    overview: movie.overview ?? null,
    tagline: movie.tagline ?? null,
    runtime: movie.runtime ?? null,
    genres: movie.genres?.map((genre) => genre.name).join(", ") ?? null,
    imdbId: movie.external_ids?.imdb_id ?? null,
  };
}

export function getPosterUrl(path: string | null | undefined): string | null {
  return path ? `${TMDB_IMAGE_BASE}${path}` : null;
}
