import { NextResponse } from "next/server";
import {
  discoverTmdbMovies,
  getTmdbMovieLocalized,
  TmdbError,
  type TmdbMovieSearchResult,
} from "@/lib/tmdb";

export const dynamic = "force-dynamic";

const LANGUAGE = "pt-BR";
const ALLOWED_COUNTS = [4, 8, 16];

type PoolMovie = {
  id: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  backdropPath: string | null;
  rating: number | null;
  overview: string | null;
  genreIds: number[];
};

function yearOf(releaseDate?: string): number | null {
  return releaseDate ? Number(releaseDate.slice(0, 4)) || null : null;
}

function toPoolMovie(movie: TmdbMovieSearchResult): PoolMovie {
  return {
    id: movie.id,
    title: movie.title,
    year: yearOf(movie.release_date),
    posterPath: movie.poster_path ?? null,
    backdropPath: movie.backdrop_path ?? null,
    rating: movie.vote_average ?? null,
    overview: movie.overview?.trim() || null,
    genreIds: movie.genre_ids ?? [],
  };
}

// Fisher-Yates shuffle (route runtime, Math.random is fine here).
function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function errorResponse(error: unknown) {
  if (error instanceof TmdbError) {
    return NextResponse.json({ error: error.message, status: error.status }, { status: error.status });
  }
  return NextResponse.json(
    { error: "Serviço temporariamente indisponível. Tente novamente.", status: 502 },
    { status: 502 },
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  // --- Winner detail mode: localized full details for a single movie. ---
  const movieIdParam = Number(url.searchParams.get("movieId"));
  if (Number.isInteger(movieIdParam) && movieIdParam > 0) {
    try {
      const movie = await getTmdbMovieLocalized(movieIdParam, LANGUAGE);
      return NextResponse.json({
        movie: {
          id: movie.id,
          title: movie.title,
          year: yearOf(movie.release_date),
          runtime: movie.runtime ?? null,
          genres: movie.genres?.map((genre) => genre.name) ?? [],
          overview: movie.overview?.trim() || null,
          backdropPath: movie.backdrop_path ?? null,
          posterPath: movie.poster_path ?? null,
          rating: movie.vote_average ?? null,
        },
      });
    } catch (error) {
      return errorResponse(error);
    }
  }

  // --- Pool mode: discover a shuffled sample of `count` movies. ---
  const genres = (url.searchParams.get("genres") ?? "").split(",").map((g) => g.trim()).filter(Boolean);
  const people = (url.searchParams.get("people") ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  const yearFrom = Number(url.searchParams.get("yearFrom"));
  const yearTo = Number(url.searchParams.get("yearTo"));
  const runtimeMax = Number(url.searchParams.get("runtimeMax"));
  const requestedCount = Number(url.searchParams.get("count"));
  const count = ALLOWED_COUNTS.includes(requestedCount) ? requestedCount : 8;

  const discoverParams: Record<string, string> = {
    language: LANGUAGE,
    region: "BR",
    sort_by: "popularity.desc",
    "vote_count.gte": "50",
  };
  if (genres.length) discoverParams.with_genres = genres.join(",");
  if (people.length) discoverParams.with_people = people.join("|"); // OR across cast + crew
  if (Number.isInteger(yearFrom) && yearFrom > 1800) discoverParams["primary_release_date.gte"] = `${yearFrom}-01-01`;
  if (Number.isInteger(yearTo) && yearTo > 1800) discoverParams["primary_release_date.lte"] = `${yearTo}-12-31`;
  if (Number.isInteger(runtimeMax) && runtimeMax > 0) discoverParams["with_runtime.lte"] = String(runtimeMax);

  try {
    // Randomize page (1–5) so repeat spins with the same filters vary. Refetch
    // page 1 if the random page overshot the available result count.
    const randomPage = 1 + Math.floor(Math.random() * 5);
    discoverParams.page = String(randomPage);
    let result = await discoverTmdbMovies(discoverParams);

    if (result.results.length === 0 && randomPage > 1) {
      discoverParams.page = "1";
      result = await discoverTmdbMovies(discoverParams);
    }

    const pool = shuffle(result.results).slice(0, count).map(toPoolMovie);
    return NextResponse.json({ movies: pool, totalResults: result.total_results });
  } catch (error) {
    return errorResponse(error);
  }
}
