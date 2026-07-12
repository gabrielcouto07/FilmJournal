import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTmdbMovie, searchTmdbMovies, TmdbError } from "@/lib/tmdb";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof TmdbError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: "Search is temporarily unavailable. Please try again." }, { status: 500 });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));
  const query = url.searchParams.get("q")?.trim() ?? "";
  const yearValue = Number(url.searchParams.get("year"));
  const pageValue = Number(url.searchParams.get("page"));

  try {
    if (Number.isInteger(id) && id > 0) {
      const [movie, existing] = await Promise.all([
        getTmdbMovie(id),
        prisma.movie.findUnique({ where: { tmdbId: id }, select: { id: true, updatedAt: true, watchlist: true, favoriteRank: true } }),
      ]);
      return NextResponse.json({ movie, existing });
    }

    const results = await searchTmdbMovies(
      query,
      Number.isInteger(yearValue) && yearValue > 1800 ? yearValue : undefined,
      Number.isInteger(pageValue) ? pageValue : 1,
    );
    const existingMovies = await prisma.movie.findMany({
      where: { tmdbId: { in: results.results.map((movie) => movie.id) } },
      select: { id: true, tmdbId: true, updatedAt: true, watchlist: true, favoriteRank: true },
    });
    const existingByTmdbId = new Map(existingMovies.map((movie) => [movie.tmdbId, movie]));

    return NextResponse.json({
      ...results,
      results: results.results.map((movie) => ({
        ...movie,
        existing: existingByTmdbId.get(movie.id) ?? null,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
