import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enrichMovieMetadata } from "@/lib/movie-metadata";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Background metadata enrichment, kept OUT of the render path. Pages that show
 * catalog movies fire this after paint (see BackgroundEnrich); it resolves TMDB
 * data for the caller's movies that are still missing it and returns how many it
 * filled so the client can refresh only when something actually changed.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  let body: { movieIds?: unknown; limit?: unknown } = {};
  try { body = await request.json(); } catch { /* empty body is fine */ }

  let ids: string[];
  if (Array.isArray(body.movieIds)) {
    ids = body.movieIds.filter((value): value is string => typeof value === "string").slice(0, 20);
  } else {
    const limit = Math.min(Math.max(Number(body.limit) || 12, 1), 20);
    const candidates = await prisma.userMovie.findMany({
      where: { userId: user.id, movie: { OR: [{ tmdbId: null }, { posterPath: null }, { genres: null }, { directors: null }] } },
      select: { movieId: true },
      orderBy: [{ favorite: "desc" }, { rating: "desc" }, { updatedAt: "desc" }],
      take: limit,
    });
    ids = candidates.map((candidate) => candidate.movieId);
  }

  let enriched = 0;
  for (const id of ids) {
    try {
      const before = await prisma.movie.findUnique({ where: { id }, select: { tmdbId: true, posterPath: true, directors: true } });
      const after = await enrichMovieMetadata(id);
      if (after && (after.tmdbId !== before?.tmdbId || after.posterPath !== before?.posterPath || after.directors !== before?.directors)) {
        enriched += 1;
      }
    } catch (error) {
      console.error(`[movies/enrich] ${id}`, error);
    }
  }

  return NextResponse.json({ enriched, requested: ids.length });
}
