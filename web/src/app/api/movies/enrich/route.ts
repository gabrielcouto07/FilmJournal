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

/** Evita repetir por algumas horas consultas ao TMDB que não trouxeram dados novos. */
const NO_CHANGE_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const noChangeAttempts = new Map<string, number>();

function underCooldown(movieId: string): boolean {
  const lastAttempt = noChangeAttempts.get(movieId);
  return lastAttempt !== undefined && Date.now() - lastAttempt < NO_CHANGE_COOLDOWN_MS;
}

/** Completa metadados em segundo plano e avisa quando a página precisa atualizar. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return crossOriginResponse();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  let body: { movieIds?: unknown; limit?: unknown } = {};
  try { body = await request.json(); } catch { /* empty body is fine */ }

  let ids: string[];
  if (Array.isArray(body.movieIds)) {
    // A página do filme sempre ganha uma tentativa nova.
    ids = body.movieIds.filter((value): value is string => typeof value === "string").slice(0, 20);
  } else {
    const limit = Math.min(Math.max(Number(body.limit) || 12, 1), 20);
    // Busca candidatos extras para pular os que ainda estão em espera.
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

  // Limpa o cache das páginas que exibem os metadados atualizados.
  if (enriched > 0) revalidateTag(CATALOG_TAG);
  return NextResponse.json({ enriched, requested: ids.length });
}
