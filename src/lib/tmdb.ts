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
  genre_ids?: number[];
};

export type TmdbGenre = { id: number; name: string };

export type TmdbMovieDetails = TmdbMovieSearchResult & {
  tagline?: string;
  runtime?: number | null;
  genres?: Array<{ id: number; name: string }>;
  external_ids?: { imdb_id?: string | null };
  images?: { posters: TmdbPoster[]; backdrops: TmdbPoster[] };
  credits?: {
    crew: Array<{ id: number; name: string; job: string; department: string }>;
    cast: Array<{ id: number; name: string; character?: string; order: number }>;
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

type TmdbPersonSearchResponse = {
  page: number;
  results: TmdbPersonSearchResult[];
};

export type TmdbPersonMovieCredit = TmdbMovieSearchResult & {
  department?: string;
  job?: string;
};

export type TmdbFeed = "trending" | "popular" | "now-playing" | "top-rated" | "upcoming";

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

async function tmdbFetch<T>(path: string, params: Record<string, string>, refresh = false): Promise<T> {
  const searchParams = new URLSearchParams({ api_key: getApiKey(), language: "en-US", ...params });

  let response: Response;
  try {
    response = await fetch(`${TMDB_API_BASE}${path}?${searchParams.toString()}`, {
      ...(refresh ? { cache: "no-store" as const } : { next: { revalidate: 21600 } }),
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
  const normalize = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, " ").trim().toLowerCase();
  const normalizedTitle = normalize(title);
  const choose = (movies: TmdbMovieSearchResult[]) => movies.find((movie) => {
    const movieYear = movie.release_date ? Number(movie.release_date.slice(0, 4)) : null;
    const titleMatches = normalize(movie.title) === normalizedTitle || normalize(movie.original_title ?? "") === normalizedTitle;
    return titleMatches && (!year || !movieYear || Math.abs(movieYear - year) <= 1);
  }) ?? movies.find((movie) => normalize(movie.title) === normalizedTitle || normalize(movie.original_title ?? "") === normalizedTitle) ?? movies[0] ?? null;
  const firstChoice = choose(result.results);
  if (firstChoice || !year) return firstChoice;
  return choose((await searchTmdbMovies(title)).results);
}

export function getTmdbMovie(tmdbId: number): Promise<TmdbMovieDetails> {
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    throw new TmdbError("A valid TMDb movie id is required.", 400);
  }
  return tmdbFetch<TmdbMovieDetails>(`/movie/${tmdbId}`, { append_to_response: "external_ids,credits" });
}

export function getTmdbMovieWithImages(tmdbId: number): Promise<TmdbMovieDetails> {
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    throw new TmdbError("A valid TMDb movie id is required.", 400);
  }
  return tmdbFetch<TmdbMovieDetails>(`/movie/${tmdbId}`, { append_to_response: "external_ids,images,credits", include_image_language: "en,null" });
}

export async function getTmdbFeed(feed: TmdbFeed, page = 1): Promise<TmdbSearchResponse> {
  const route = feed === "trending" ? "/trending/movie/week" : `/movie/${feed.replace("-", "_")}`;
  const result = await tmdbFetch<TmdbSearchResponse>(route, { page: String(Math.min(Math.max(page, 1), 20)), region: "BR" });
  return { ...result, results: result.results.slice(0, 18) };
}

export async function getTmdbMovieRecommendations(tmdbId: number, refresh = false): Promise<TmdbSearchResponse> {
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) throw new TmdbError("A valid TMDb movie id is required.", 400);
  return tmdbFetch<TmdbSearchResponse>(`/movie/${tmdbId}/recommendations`, { page: "1" }, refresh);
}

export async function discoverTmdbMovies(params: Record<string, string>, refresh = false): Promise<TmdbSearchResponse> {
  return tmdbFetch<TmdbSearchResponse>("/discover/movie", {
    include_adult: "false",
    include_video: "false",
    page: "1",
    region: "BR",
    ...params,
  }, refresh);
}

export async function searchTmdbPerson(name: string, refresh = false): Promise<TmdbPersonSearchResult | null> {
  const query = name.trim();
  if (!query) return null;
  const response = await tmdbFetch<TmdbPersonSearchResponse>("/search/person", {
    query,
    include_adult: "false",
    page: "1",
  }, refresh);
  return response.results.find((person) => person.known_for_department === "Directing") ?? response.results[0] ?? null;
}

export async function getTmdbPersonDirectedMovies(personId: number, refresh = false): Promise<TmdbMovieSearchResult[]> {
  if (!Number.isInteger(personId) || personId <= 0) throw new TmdbError("A valid TMDb person id is required.", 400);
  const response = await tmdbFetch<{ crew: TmdbPersonMovieCredit[] }>(`/person/${personId}/movie_credits`, {}, refresh);
  return response.crew.filter((movie) => movie.job === "Director")
    .sort((left, right) => (right.vote_average ?? 0) - (left.vote_average ?? 0));
}

// --- Roulette (TMDB-powered global discovery) helpers, localized to pt-BR ---

export async function getTmdbGenres(language = "pt-BR"): Promise<TmdbGenre[]> {
  const response = await tmdbFetch<{ genres: TmdbGenre[] }>("/genre/movie/list", { language });
  return response.genres;
}

export async function searchTmdbPeople(query: string, language = "pt-BR"): Promise<TmdbPersonSearchResult[]> {
  const normalized = query.trim();
  if (normalized.length < 2) return [];
  const response = await tmdbFetch<TmdbPersonSearchResponse>("/search/person", {
    query: normalized,
    include_adult: "false",
    page: "1",
    language,
  });
  return response.results.slice(0, 8);
}

/** Full movie details in a given language (runtime + genre names + backdrop + overview). */
export async function getTmdbMovieLocalized(tmdbId: number, language = "pt-BR"): Promise<TmdbMovieDetails> {
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) throw new TmdbError("A valid TMDb movie id is required.", 400);
  return tmdbFetch<TmdbMovieDetails>(`/movie/${tmdbId}`, { language });
}

export function toMovieMetadata(movie: TmdbMovieDetails) {
  const directors = movie.credits?.crew.filter((person) => person.job === "Director").map((person) => person.name) ?? [];
  const cast = movie.credits?.cast.slice().sort((left, right) => left.order - right.order).slice(0, 8).map((person) => person.name) ?? [];
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
    releaseDate: movie.release_date ? new Date(`${movie.release_date}T12:00:00.000Z`) : null,
    directors: directors.length ? directors.join(", ") : null,
    cast: cast.length ? cast.join(", ") : null,
    tmdbRating: movie.vote_average ?? null,
    tmdbVoteCount: movie.vote_count ?? null,
  };
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

function cleanArtworkPath(path: string | null | undefined): string | null {
  const cleaned = path?.trim();
  return cleaned && cleaned !== "null" && cleaned !== "undefined" ? cleaned : null;
}
