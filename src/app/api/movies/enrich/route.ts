import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enrichMovieMetadata } from "@/lib/movie-metadata";
import { CATALOG_TAG } from "@/lib/data";
import { crossOriginResponse, isSameOrigin } from "@/lib/security";

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
  if (!isSameOrigin(request)) return crossOriginResponse();
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
      where: { userId: user.id, movie: { OR: [{ tmdbId: null }, { posterPath: null }, { genres: null }, { directors: null }, { originalLanguage: null }] } },
      select: { movieId: true },
      orderBy: [{ favorite: "desc" }, { rating: "desc" }, { updatedAt: "desc" }],
      take: limit,
    });
    ids = candidates.map((candidate) => candidate.movieId);
  }

  let enriched = 0;
  for (const id of ids) {
    try {
      const before = await prisma.movie.findUnique({ where: { id }, select: { tmdbId: true, posterPath: true, directors: true, originalLanguage: true } });
      const after = await enrichMovieMetadata(id);
      if (after && (after.tmdbId !== before?.tmdbId || after.posterPath !== before?.posterPath || after.directors !== before?.directors || after.originalLanguage !== before?.originalLanguage)) {
        enriched += 1;
      }
    } catch (error) {
      console.error(`[movies/enrich] ${id}`, error);
    }
  }

  // Filled-in metadata lives on the shared catalog; drop every cached page that
  // shows it so the follow-up router.refresh() sees the new posters/credits.
  if (enriched > 0) revalidateTag(CATALOG_TAG);
  return NextResponse.json({ enriched, requested: ids.length });
}
