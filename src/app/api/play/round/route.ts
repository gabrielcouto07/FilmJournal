import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { crossOriginResponse, isSameOrigin } from "@/lib/security";
import { getTmdbFeed, getTmdbMovie, TmdbError } from "@/lib/tmdb";
import { MAX_REVEALS, ROUND_MS } from "@/lib/play/scoring";
import { sealRound, type RoundPayload } from "@/lib/play/token";

export const dynamic = "force-dynamic";

const TOKEN_TTL_MS = 15 * 60_000;
/** Targets need a recognizable billed cast to be challenging-but-fair. */
const MIN_CAST = 3;
const MIN_VOTES_MINE = 100;
const MIN_VOTES_POPULAR = 1000;
const PICK_ATTEMPTS = 6;

const roundSchema = z.object({
  source: z.enum(["mine", "popular"]),
  excludeIds: z.array(z.number().int().positive()).max(50).default([]),
});

function shufflePick<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Fetch credits from TMDB and cache them on the Movie row (backfill pattern). */
async function fetchAndCacheCast(movieId: string, tmdbId: number): Promise<{ cast: string[]; originalTitle: string | null }> {
  const details = await getTmdbMovie(tmdbId);
  const cast = (details.credits?.cast ?? [])
    .slice()
    .sort((left, right) => left.order - right.order)
    .slice(0, 8)
    .map((person) => person.name);
  const directors = details.credits?.crew.filter((person) => person.job === "Director").map((person) => person.name) ?? [];
  if (cast.length) {
    await prisma.movie.update({
      where: { id: movieId },
      data: { cast: cast.join(", "), directors: directors.length ? directors.join(", ") : undefined },
    });
  }
  return { cast, originalTitle: details.original_title ?? null };
}

async function buildMineRound(userId: string, excludeIds: number[]): Promise<RoundPayload | null> {
  const candidates = await prisma.movie.findMany({
    where: {
      tmdbId: { not: null, notIn: excludeIds.length ? excludeIds : undefined },
      tmdbVoteCount: { gte: MIN_VOTES_MINE },
      userMovies: { some: { userId, OR: [{ watched: true }, { rating: { not: null } }] } },
    },
    select: { id: true, tmdbId: true, title: true, year: true, posterPath: true, preferredPosterPath: true, cast: true },
  });

  for (const movie of shufflePick(candidates).slice(0, PICK_ATTEMPTS)) {
    let cast = (movie.cast ?? "").split(",").map((name) => name.trim()).filter(Boolean);
    let originalTitle: string | null = null;
    if (cast.length < MIN_CAST) {
      try {
        const fetched = await fetchAndCacheCast(movie.id, movie.tmdbId!);
        cast = fetched.cast;
        originalTitle = fetched.originalTitle;
      } catch {
        continue; // TMDB hiccup on this candidate — try the next one
      }
    }
    if (cast.length < MIN_CAST) continue;
    return {
      tmdbId: movie.tmdbId!,
      title: movie.title,
      originalTitle,
      year: movie.year,
      posterPath: movie.preferredPosterPath ?? movie.posterPath,
      cast: cast.slice(0, MAX_REVEALS),
      source: "mine",
      exp: Date.now() + TOKEN_TTL_MS,
    };
  }
  return null;
}

async function buildPopularRound(excludeIds: number[]): Promise<RoundPayload | null> {
  const page = 1 + Math.floor(Math.random() * 5);
  const feed = await getTmdbFeed("popular", page);
  const excluded = new Set(excludeIds);
  const candidates = feed.results.filter((movie) => (movie.vote_count ?? 0) >= MIN_VOTES_POPULAR && !excluded.has(movie.id));

  for (const candidate of shufflePick(candidates).slice(0, PICK_ATTEMPTS)) {
    try {
      const details = await getTmdbMovie(candidate.id);
      const cast = (details.credits?.cast ?? [])
        .slice()
        .sort((left, right) => left.order - right.order)
        .slice(0, MAX_REVEALS)
        .map((person) => person.name);
      if (cast.length < MIN_CAST) continue;
      return {
        tmdbId: details.id,
        title: details.title,
        originalTitle: details.original_title ?? null,
        year: details.release_date ? Number(details.release_date.slice(0, 4)) || null : null,
        posterPath: details.poster_path ?? null,
        cast,
        source: "popular",
        exp: Date.now() + TOKEN_TTL_MS,
      };
    } catch {
      continue;
    }
  }
  return null;
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return crossOriginResponse();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Faça login para jogar." }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "O corpo deve ser um JSON válido." }, { status: 400 }); }
  const parsed = roundSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  try {
    const payload = parsed.data.source === "mine"
      ? await buildMineRound(user.id, parsed.data.excludeIds)
      : await buildPopularRound(parsed.data.excludeIds);

    if (!payload) {
      return NextResponse.json(
        { error: parsed.data.source === "mine"
          ? "Seu arquivo não tem filmes elegíveis suficientes (com elenco conhecido) para uma rodada."
          : "Não foi possível montar uma rodada agora. Tente novamente." },
        { status: 409 },
      );
    }

    return NextResponse.json({
      token: sealRound(payload),
      firstCast: payload.cast[0],
      totalCast: payload.cast.length,
      roundMs: ROUND_MS,
    });
  } catch (error) {
    if (error instanceof TmdbError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Não foi possível montar a rodada." }, { status: 502 });
  }
}
