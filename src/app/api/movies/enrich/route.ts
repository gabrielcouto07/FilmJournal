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
 * The sweep fires after every dashboard paint, but some candidates can stay
 * incomplete for months (unreleased films TMDB has no poster/credits for yet,
 * upstream hiccups). Without a cooldown each of those burns a few hundred ms
 * of sequential TMDB work per pageview, forever. Attempts that changed nothing
 * are not retried for a few hours — matching the TMDB fetch-cache window, so
 * earlier retries could not see new data anyway. Per-process state: a restart
 * just allows one fresh attempt.
 */
const NO_CHANGE_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const noChangeAttempts = new Map<string, number>();

function underCooldown(movieId: string): boolean {
  const lastAttempt = noChangeAttempts.get(movieId);
  return lastAttempt !== undefined && Date.now() - lastAttempt < NO_CHANGE_COOLDOWN_MS;
}

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
    // Explicit ids (the film page) bypass the cooldown: the viewer is looking
    // straight at that movie, so one fresh attempt is always worth it.
    ids = body.movieIds.filter((value): value is string => typeof value === "string").slice(0, 20);
  } else {
    const limit = Math.min(Math.max(Number(body.limit) || 12, 1), 20);
    // Over-fetch so cooled-down candidates don't block the ones behind them.
    const candidates = await prisma.userMovie.findMany({
      where: { userId: user.id, movie: { OR: [{ tmdbId: null }, { posterPath: null }, { genres: null }, { directors: null }, { originalLanguage: null }] } },
      select: { movieId: true },
      orderBy: [{ favorite: "desc" }, { rating: "desc" }, { updatedAt: "desc" }],
      take: 50,
    });
    ids = candidates.map((candidate) => candidate.movieId).filter((id) => !underCooldown(id)).slice(0, limit);
  }

  const start = performance.now();
  let enriched = 0;
  for (const id of ids) {
    try {
      const before = await prisma.movie.findUnique({ where: { id }, select: { tmdbId: true, posterPath: true, directors: true, originalLanguage: true } });
      const after = await enrichMovieMetadata(id);
      if (after && (after.tmdbId !== before?.tmdbId || after.posterPath !== before?.posterPath || after.directors !== before?.directors || after.originalLanguage !== before?.originalLanguage)) {
        enriched += 1;
        noChangeAttempts.delete(id);
      } else {
        noChangeAttempts.set(id, Date.now());
      }
    } catch (error) {
      noChangeAttempts.set(id, Date.now());
      console.error(`[movies/enrich] ${id}`, error);
    }
  }

  console.log(`[enrich] requested=${ids.length} enriched=${enriched} in ${Math.round(performance.now() - start)}ms`);

  // Filled-in metadata lives on the shared catalog; drop every cached page that
  // shows it so the follow-up router.refresh() sees the new posters/credits.
  if (enriched > 0) revalidateTag(CATALOG_TAG);
  return NextResponse.json({ enriched, requested: ids.length });
}
