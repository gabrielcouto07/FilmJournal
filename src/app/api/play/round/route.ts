import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { crossOriginResponse, isSameOrigin } from "@/lib/security";
import { getTmdbFeed, getTmdbMovie, TmdbError } from "@/lib/tmdb";
import {
  actorsVisible,
  dailyKey,
  dailySeed,
  MAX_GUESSES,
  profileFromDetails,
  revealOrder,
  type MovieProfile,
} from "@/lib/play/hybrid";
import { sealRound, type HybridRoundPayload } from "@/lib/play/token";

export const dynamic = "force-dynamic";

/** A rodada não tem relógio e continua válida mesmo após uma pausa. */
const TOKEN_TTL_MS = 60 * 60_000;
/** O filme precisa ter elenco suficiente para render pistas justas. */
const MIN_CAST = 3;
const MIN_VOTES_MINE = 100;
const MIN_VOTES_POPULAR = 1000;
const PICK_ATTEMPTS = 6;
/** Páginas de `top_rated` disponíveis para o sorteio diário. */
const DAILY_PAGES = 20;

const roundSchema = z.object({
  source: z.enum(["mine", "popular", "daily"]),
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

/** Monta o perfil do filme ou retorna `null` quando faltam pistas de elenco. */
async function profileFor(tmdbId: number): Promise<{ profile: MovieProfile; posterPath: string | null; keywords: string[]; tagline: string | null } | null> {
  const details = await getTmdbMovie(tmdbId);
  const profile = profileFromDetails(details);
  if (profile.cast.length < MIN_CAST) return null;
  return {
    profile,
    posterPath: details.poster_path ?? null,
    keywords: (details.keywords?.keywords ?? []).slice(0, 3).map((keyword) => keyword.name),
    tagline: details.tagline?.trim() || null,
  };
}

async function buildMineRound(userId: string, excludeIds: number[]): Promise<HybridRoundPayload | null> {
  const candidates = await prisma.movie.findMany({
    where: {
      tmdbId: { not: null, notIn: excludeIds.length ? excludeIds : undefined },
      tmdbVoteCount: { gte: MIN_VOTES_MINE },
      userMovies: { some: { userId, OR: [{ watched: true }, { rating: { not: null } }] } },
    },
    select: { tmdbId: true },
  });

  for (const movie of shufflePick(candidates).slice(0, PICK_ATTEMPTS)) {
    try {
      const found = await profileFor(movie.tmdbId!);
      if (!found) continue;
      return { target: found.profile, posterPath: found.posterPath, keywords: found.keywords, tagline: found.tagline, source: "mine", exp: Date.now() + TOKEN_TTL_MS };
    } catch {
      continue; // TMDB hiccup on this candidate — try the next one
    }
  }
  return null;
}

async function buildPopularRound(excludeIds: number[]): Promise<HybridRoundPayload | null> {
  const page = 1 + Math.floor(Math.random() * 5);
  const feed = await getTmdbFeed("popular", page);
  const excluded = new Set(excludeIds);
  const candidates = feed.results.filter((movie) => (movie.vote_count ?? 0) >= MIN_VOTES_POPULAR && !excluded.has(movie.id));

  for (const candidate of shufflePick(candidates).slice(0, PICK_ATTEMPTS)) {
    try {
      const found = await profileFor(candidate.id);
      if (!found) continue;
      return { target: found.profile, posterPath: found.posterPath, keywords: found.keywords, tagline: found.tagline, source: "popular", exp: Date.now() + TOKEN_TTL_MS };
    } catch {
      continue;
    }
  }
  return null;
}

/** Escolhe o filme do dia de forma estável a partir da data e do `top_rated`. */
async function buildDailyRound(): Promise<HybridRoundPayload | null> {
  const seed = dailySeed(dailyKey(new Date()));
  const page = 1 + (seed % DAILY_PAGES);
  const feed = await getTmdbFeed("top-rated", page);
  const candidates = feed.results.filter((movie) => (movie.vote_count ?? 0) >= MIN_VOTES_POPULAR);
  if (!candidates.length) return null;

  // Avança de forma previsível até encontrar um candidato válido.
  for (let step = 0; step < Math.min(candidates.length, PICK_ATTEMPTS); step += 1) {
    const candidate = candidates[((seed >>> 5) + step) % candidates.length];
    try {
      const found = await profileFor(candidate.id);
      if (!found) continue;
      return { target: found.profile, posterPath: found.posterPath, keywords: found.keywords, tagline: found.tagline, source: "daily", exp: Date.now() + TOKEN_TTL_MS };
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
      : parsed.data.source === "popular"
        ? await buildPopularRound(parsed.data.excludeIds)
        : await buildDailyRound();

    if (!payload) {
      return NextResponse.json(
        { error: parsed.data.source === "mine"
          ? "Seu arquivo não tem filmes elegíveis suficientes (com elenco conhecido) para uma rodada."
          : "Não foi possível montar uma rodada agora. Tente novamente." },
        { status: 409 },
      );
    }

    // Envia só a primeira pista; as demais chegam conforme os palpites.
    const reveals = revealOrder(payload.target.cast);
    const visible = actorsVisible(1, reveals.length);
    return NextResponse.json({
      token: sealRound(payload),
      maxGuesses: MAX_GUESSES,
      castTotal: reveals.length,
      actors: reveals.slice(0, visible).map((member) => ({ name: member.name, profilePath: member.profilePath })),
      source: payload.source,
      dayKey: payload.source === "daily" ? dailyKey(new Date()) : null,
    });
  } catch (error) {
    if (error instanceof TmdbError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Não foi possível montar a rodada." }, { status: 502 });
  }
}
