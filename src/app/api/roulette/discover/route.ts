import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getBlindSpotPool } from "@/lib/discover";
import { prisma } from "@/lib/prisma";
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
  /** Explica por que o filme ajuda a explorar um ponto cego. */
  rationale?: string;
  gapLabel?: string;
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

// Embaralhamento Fisher-Yates; `Math.random` basta para este sorteio.
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

  // Detalhes completos do filme sorteado.
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

  // Monta uma amostra embaralhada com `count` filmes.
  const source = url.searchParams.get("source") ?? "popular";
  const genres = (url.searchParams.get("genres") ?? "").split(",").map((g) => g.trim()).filter(Boolean);
  const people = (url.searchParams.get("people") ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  const yearFrom = Number(url.searchParams.get("yearFrom"));
  const yearTo = Number(url.searchParams.get("yearTo"));
  const runtimeMax = Number(url.searchParams.get("runtimeMax"));
  const requestedCount = Number(url.searchParams.get("count"));
  const count = ALLOWED_COUNTS.includes(requestedCount) ? requestedCount : 8;

  // Fontes pessoais exigem uma sessão ativa.
  if (source === "watchlist" || source === "blindspots") {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Faça login para usar esta fonte." }, { status: 401 });

    try {
      if (source === "blindspots") {
        const entries = await getBlindSpotPool(user.id, {
          count,
          yearFrom: Number.isInteger(yearFrom) && yearFrom > 1800 ? yearFrom : undefined,
          yearTo: Number.isInteger(yearTo) && yearTo > 1800 ? yearTo : undefined,
          genreIds: genres.map(Number).filter((id) => Number.isInteger(id) && id > 0),
        });
        const pool: PoolMovie[] = entries.map((entry) => ({
          id: entry.tmdbId,
          title: entry.title,
          year: entry.year,
          posterPath: entry.posterPath,
          backdropPath: entry.backdropPath,
          rating: entry.rating,
          overview: entry.overview,
          genreIds: entry.genreIds,
          rationale: entry.rationale,
          gapLabel: entry.gapLabel,
        }));
        return NextResponse.json({ movies: pool, totalResults: pool.length });
      }

      // Na lista para assistir, o sorteio usa os filmes salvos pelo usuário.
      const genreIds = genres.map(Number).filter((id) => Number.isInteger(id) && id > 0);
      const rows = await prisma.userMovie.findMany({
        where: { userId: user.id, watchlist: true, movie: { tmdbId: { not: null } } },
        select: {
          movie: {
            select: {
              tmdbId: true, title: true, year: true, runtime: true, overview: true,
              posterPath: true, preferredPosterPath: true, backdropPath: true, preferredBackdropPath: true,
              tmdbRating: true, genreList: { select: { id: true } },
            },
          },
        },
      });
      const filtered = rows
        .map((row) => row.movie)
        .filter((movie) => !(Number.isInteger(yearFrom) && yearFrom > 1800) || (movie.year ?? 0) >= yearFrom)
        .filter((movie) => !(Number.isInteger(yearTo) && yearTo > 1800) || (movie.year ?? 9999) <= yearTo)
        // Com limite de duração, filmes sem duração conhecida ficam de fora.
        .filter((movie) => !(Number.isInteger(runtimeMax) && runtimeMax > 0) || (movie.runtime != null && movie.runtime <= runtimeMax))
        .filter((movie) => !genreIds.length || movie.genreList.some((genre) => genreIds.includes(genre.id)));

      const pool: PoolMovie[] = shuffle(filtered).slice(0, count).map((movie) => ({
        id: movie.tmdbId!,
        title: movie.title,
        year: movie.year,
        posterPath: movie.preferredPosterPath ?? movie.posterPath,
        backdropPath: movie.preferredBackdropPath ?? movie.backdropPath,
        rating: movie.tmdbRating,
        overview: movie.overview,
        genreIds: movie.genreList.map((genre) => genre.id),
      }));
      return NextResponse.json({ movies: pool, totalResults: filtered.length });
    } catch (error) {
      return errorResponse(error);
    }
  }

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
    // Varia a página entre giros e volta à primeira se a escolhida estiver vazia.
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
