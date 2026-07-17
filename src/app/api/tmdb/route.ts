import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTmdbFeed, getTmdbMovieWithImages, searchTmdbMovies, TmdbError, type TmdbFeed } from "@/lib/tmdb";
import { getOwnerUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof TmdbError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: "A busca está temporariamente indisponível. Tente novamente." }, { status: 500 });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));
  const query = url.searchParams.get("q")?.trim() ?? "";
  const yearValue = Number(url.searchParams.get("year"));
  const pageValue = Number(url.searchParams.get("page"));
  const feed = url.searchParams.get("feed") as TmdbFeed | null;

  const owner = await getOwnerUser();
  const ownerId = owner?.id || "";

  try {
    if (Number.isInteger(id) && id > 0) {
      const [movie, movieRecord, userMovie] = await Promise.all([
        getTmdbMovieWithImages(id),
        prisma.movie.findUnique({ where: { tmdbId: id }, select: { id: true, updatedAt: true } }),
        prisma.userMovie.findFirst({ where: { userId: ownerId, movie: { tmdbId: id } }, select: { watchlist: true, favoriteRank: true } })
      ]);

      const existing = movieRecord ? {
        id: movieRecord.id,
        updatedAt: movieRecord.updatedAt,
        watchlist: userMovie?.watchlist ?? false,
        favoriteRank: userMovie?.favoriteRank ?? null
      } : null;

      return NextResponse.json({ movie, existing });
    }

    if (feed && ["trending", "popular", "now-playing", "top-rated", "upcoming"].includes(feed)) {
      const results = await getTmdbFeed(feed, Number.isInteger(pageValue) ? pageValue : 1);
      const ids = results.results.map((movie) => movie.id);
      
      const existingMovies = await prisma.movie.findMany({
        where: { tmdbId: { in: ids } },
        select: { id: true, tmdbId: true, updatedAt: true },
      });

      const existingIds = existingMovies.map(m => m.id);
      const userMovies = await prisma.userMovie.findMany({
        where: { userId: ownerId, movieId: { in: existingIds } },
        select: { movieId: true, watchlist: true, favorite: true, favoriteRank: true }
      });
      const umMap = new Map(userMovies.map(um => [um.movieId, um]));

      const existingById = new Map(existingMovies.map((m) => {
        const um = umMap.get(m.id);
        return [m.tmdbId, {
          id: m.id,
          tmdbId: m.tmdbId,
          updatedAt: m.updatedAt,
          watchlist: um?.watchlist ?? false,
          favorite: um?.favorite ?? false,
          favoriteRank: um?.favoriteRank ?? null
        }];
      }));

      const response = NextResponse.json({ ...results, results: results.results.map((movie) => ({ ...movie, existing: existingById.get(movie.id) ?? null })) });
      response.headers.set("Cache-Control", "private, max-age=300, stale-while-revalidate=21600");
      return response;
    }

    const results = await searchTmdbMovies(
      query,
      Number.isInteger(yearValue) && yearValue > 1800 ? yearValue : undefined,
      Number.isInteger(pageValue) ? pageValue : 1,
    );

    const existingMovies = await prisma.movie.findMany({
      where: { tmdbId: { in: results.results.map((movie) => movie.id) } },
      select: { id: true, tmdbId: true, updatedAt: true },
    });

    const existingIds = existingMovies.map(m => m.id);
    const userMovies = await prisma.userMovie.findMany({
      where: { userId: ownerId, movieId: { in: existingIds } },
      select: { movieId: true, watchlist: true, favorite: true, favoriteRank: true }
    });
    const umMap = new Map(userMovies.map(um => [um.movieId, um]));

    const existingByTmdbId = new Map(existingMovies.map((m) => {
      const um = umMap.get(m.id);
      return [m.tmdbId, {
        id: m.id,
        tmdbId: m.tmdbId,
        updatedAt: m.updatedAt,
        watchlist: um?.watchlist ?? false,
        favorite: um?.favorite ?? false,
        favoriteRank: um?.favoriteRank ?? null
      }];
    }));

    const response = NextResponse.json({
      ...results,
      results: results.results.map((movie) => ({
        ...movie,
        existing: existingByTmdbId.get(movie.id) ?? null,
      })),
    });
    response.headers.set("Cache-Control", "private, max-age=30, stale-while-revalidate=120");
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
