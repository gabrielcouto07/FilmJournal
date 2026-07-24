import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { discoverTmdbMovies, getTmdbFeed, getTmdbMovie, searchTmdbMovies, TmdbError } from "../../lib/tmdb.js";
import {
  actorsVisible,
  CAST_REVEALS,
  dailyKey,
  dailySeed,
  gradeGuess,
  hintUnlocked,
  MAX_GUESSES,
  posterStage,
  profileFromDetails,
  revealOrder,
  type MovieProfile,
} from "../../lib/play/hybrid.js";
import { openRound, sealRound, type HybridRoundPayload } from "../../lib/play/token.js";
import { requireAuth } from "../../plugins/jwt.js";

/** A rodada não tem relógio e continua válida mesmo após uma pausa. */
const TOKEN_TTL_MS = 60 * 60_000;
/** O filme precisa ter elenco suficiente para render pistas justas. */
const MIN_CAST = 3;
const MIN_VOTES_MINE = 100;
const MIN_VOTES_POPULAR = 1000;
const PICK_ATTEMPTS = 6;
/** Páginas de `top_rated` disponíveis para o sorteio diário. */
const DAILY_PAGES = 20;
/**
 * Quantas páginas de "mais votados" o modo Populares amostra. Ordenando por
 * número de votos, ~15 páginas ≈ os 300 filmes mais assistidos do mundo: mistura
 * épocas (clássicos entram porque acumulam votos) e cults de grande público,
 * enquanto o piso de votos/nota corta o que quase ninguém conhece.
 */
const POPULAR_PAGES = 15;
/** Nota mínima no modo Populares — evita "famoso porém ruim", mantém os cults. */
const MIN_RATING_POPULAR = 6;

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
  // "Popular" = amplamente assistido em qualquer época, não só o hype do momento.
  // `/movie/popular` do TMDB pondera lançamentos recentes; ordenar o Discover por
  // `vote_count.desc` traz os títulos que mais gente viu no mundo (inclui antigos
  // e cults consagrados). O piso de votos + nota mantém tudo reconhecível.
  const page = 1 + Math.floor(Math.random() * POPULAR_PAGES);
  const feed = await discoverTmdbMovies({
    sort_by: "vote_count.desc",
    "vote_count.gte": String(MIN_VOTES_POPULAR),
    "vote_average.gte": String(MIN_RATING_POPULAR),
    page: String(page),
  });
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

/** Reúne palpite, dica e desistência sem expor a resposta no tráfego comum. */
const guessSchema = z.object({
  token: z.string().min(1),
  action: z.enum(["guess", "hint", "giveup"]),
  /** ID do filme no TMDB, obrigatório em um palpite. */
  tmdbId: z.number().int().positive().optional(),
  guessNumber: z.number().int().min(1).max(MAX_GUESSES),
  /** 1 = palavras-chave; 2 = tagline. */
  hint: z.union([z.literal(1), z.literal(2)]).optional(),
});

/** Resposta completa, enviada apenas no fim da rodada. */
function answerFrom(round: HybridRoundPayload) {
  return {
    tmdbId: round.target.tmdbId,
    title: round.target.title,
    year: round.target.year,
    posterPath: round.posterPath,
    directorName: round.target.directorName,
    genres: round.target.genres.map((genre) => genre.name),
    cast: round.target.cast.slice(0, CAST_REVEALS).map((member) => member.name),
    tagline: round.tagline,
  };
}

/** Pistas liberadas para o próximo palpite. */
function cluesFor(round: HybridRoundPayload, nextGuessNumber: number) {
  const reveals = revealOrder(round.target.cast);
  const previouslyVisible = actorsVisible(nextGuessNumber - 1, reveals.length);
  const nowVisible = actorsVisible(nextGuessNumber, reveals.length);
  const newActor = nowVisible > previouslyVisible ? reveals[nowVisible - 1] : null;
  const stage = posterStage(nextGuessNumber);
  return {
    actor: newActor ? { name: newActor.name, profilePath: newActor.profilePath } : null,
    poster: stage === "hidden" ? null : { path: round.posterPath, stage },
    hints: { keywords: hintUnlocked(1, nextGuessNumber), tagline: hintUnlocked(2, nextGuessNumber) },
  };
}

const GAME = "hybrid";

const scoreSchema = z.object({
  source: z.enum(["mine", "popular", "daily"]),
  score: z.number().int().min(0).max(100_000),
  /** No Cine-Detetive, indica quantos palpites foram usados. */
  rounds: z.number().int().min(1).max(20),
});

type Suggestion = { tmdbId: number; title: string; year: number | null };

export default async function playRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: unknown }>("/play/round", { preHandler: requireAuth }, async (request, reply) => {
    const user = request.user!;

    const parsed = roundSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Dados inválidos." });

    try {
      const payload = parsed.data.source === "mine"
        ? await buildMineRound(user.id, parsed.data.excludeIds)
        : parsed.data.source === "popular"
          ? await buildPopularRound(parsed.data.excludeIds)
          : await buildDailyRound();

      if (!payload) {
        return reply.status(409).send({
          error: parsed.data.source === "mine"
            ? "Seu arquivo não tem filmes elegíveis suficientes (com elenco conhecido) para uma rodada."
            : "Não foi possível montar uma rodada agora. Tente novamente.",
        });
      }

      // Envia só a primeira pista; as demais chegam conforme os palpites.
      const reveals = revealOrder(payload.target.cast);
      const visible = actorsVisible(1, reveals.length);
      return reply.send({
        token: sealRound(payload),
        maxGuesses: MAX_GUESSES,
        castTotal: reveals.length,
        actors: reveals.slice(0, visible).map((member) => ({ name: member.name, profilePath: member.profilePath })),
        source: payload.source,
        dayKey: payload.source === "daily" ? dailyKey(new Date()) : null,
      });
    } catch (error) {
      if (error instanceof TmdbError) return reply.status(error.status).send({ error: error.message });
      return reply.status(502).send({ error: "Não foi possível montar a rodada." });
    }
  });

  fastify.post<{ Body: unknown }>("/play/guess", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = guessSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Dados inválidos." });

    const round = openRound(parsed.data.token);
    if (!round) return reply.status(410).send({ error: "Rodada expirada — comece outra." });

    if (parsed.data.action === "giveup") {
      return reply.send({ answer: answerFrom(round) });
    }

    if (parsed.data.action === "hint") {
      const hint = parsed.data.hint;
      if (!hint) return reply.status(400).send({ error: "Dados inválidos." });
      if (!hintUnlocked(hint, parsed.data.guessNumber)) {
        return reply.status(403).send({ error: "Essa dica ainda não foi liberada." });
      }
      return reply.send(hint === 1 ? { keywords: round.keywords } : { tagline: round.tagline });
    }

    if (!parsed.data.tmdbId) return reply.status(400).send({ error: "Escolha um filme na lista de sugestões." });

    try {
      const guessedDetails = await getTmdbMovie(parsed.data.tmdbId);
      const guessProfile = profileFromDetails(guessedDetails);
      const grade = gradeGuess(guessProfile, round.target);
      // Compara o cartão do palpite com o filme secreto.
      const guessCard = { title: guessProfile.title, year: guessProfile.year, posterPath: guessedDetails.poster_path ?? null };

      if (grade.correct) {
        return reply.send({ correct: true, tiles: grade.tiles, guess: guessCard, answer: answerFrom(round) });
      }

      const gameOver = parsed.data.guessNumber >= MAX_GUESSES;
      return reply.send({
        correct: false,
        tiles: grade.tiles,
        guess: guessCard,
        gameOver,
        ...(gameOver
          ? { answer: answerFrom(round) }
          : { next: cluesFor(round, parsed.data.guessNumber + 1) }),
      });
    } catch (error) {
      if (error instanceof TmdbError) return reply.status(error.status).send({ error: error.message });
      return reply.status(502).send({ error: "Falha ao validar o palpite." });
    }
  });

  fastify.get("/play/score", { preHandler: requireAuth }, async (request, reply) => {
    const user = request.user!;
    const rows = await prisma.gameScore.findMany({ where: { userId: user.id, game: GAME } });
    const bySource = Object.fromEntries(rows.map((row) => [row.source, { bestScore: row.bestScore, bestRounds: row.bestRounds }]));
    return reply.send({ scores: bySource });
  });

  fastify.post<{ Body: unknown }>("/play/score", { preHandler: requireAuth }, async (request, reply) => {
    const user = request.user!;

    const parsed = scoreSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Dados inválidos." });

    const { source, score, rounds } = parsed.data;
    const current = await prisma.gameScore.findUnique({ where: { userId_game_source: { userId: user.id, game: GAME, source } } });
    const improved = !current || score > current.bestScore;

    if (improved) {
      await prisma.gameScore.upsert({
        where: { userId_game_source: { userId: user.id, game: GAME, source } },
        create: { userId: user.id, game: GAME, source, bestScore: score, bestRounds: rounds },
        update: { bestScore: score, bestRounds: rounds },
      });
    }

    return reply.send({ improved, bestScore: improved ? score : current!.bestScore });
  });

  /**
   * Autocomplete do jogo. Sugere filmes conforme o usuário digita (prefixo/trecho).
   * O TMDb casa títulos em qualquer idioma, então funciona digitando em inglês ou
   * em português; os resultados voltam com o título em pt-BR. Em "mine" prioriza a
   * biblioteca do usuário e completa com o TMDb para nunca ficar sem sugestões.
   */
  fastify.get<{ Querystring: { q?: string; source?: string } }>("/play/search", { preHandler: requireAuth }, async (request, reply) => {
    const user = request.user!;
    const query = (request.query.q ?? "").trim();
    const source = request.query.source === "mine" ? "mine" : "popular";
    if (query.length < 2) return reply.send({ suggestions: [] });

    const fromTmdb = async (): Promise<Suggestion[]> => {
      try {
        const result = await searchTmdbMovies(query, undefined, 1, "pt-BR");
        return result.results.map((movie) => ({
          tmdbId: movie.id,
          title: movie.title || movie.original_title || "",
          year: movie.release_date ? Number(movie.release_date.slice(0, 4)) || null : null,
        }));
      } catch {
        return []; // autocomplete é best-effort (ex.: TMDb indisponível)
      }
    };

    try {
      const suggestions: Suggestion[] = [];
      const seen = new Set<number>();
      const push = (list: Suggestion[]) => {
        for (const item of list) {
          if (item.tmdbId && item.title && !seen.has(item.tmdbId)) {
            seen.add(item.tmdbId);
            suggestions.push(item);
          }
        }
      };

      if (source === "mine") {
        // Só sugere filmes com ID do TMDb, usado para avaliar o palpite.
        const movies = await prisma.movie.findMany({
          where: {
            title: { contains: query, mode: "insensitive" },
            tmdbId: { not: null },
            userMovies: { some: { userId: user.id, OR: [{ watched: true }, { rating: { not: null } }] } },
          },
          select: { tmdbId: true, title: true, year: true },
          orderBy: [{ tmdbVoteCount: "desc" }],
          take: 8,
        });
        push(movies.map((movie) => ({ tmdbId: movie.tmdbId as number, title: movie.title, year: movie.year })));
        // Completa com o catálogo global para não ficar vazio (ex.: biblioteca nova).
        if (suggestions.length < 8) push(await fromTmdb());
      } else {
        push(await fromTmdb());
      }

      return reply.send({ suggestions: suggestions.slice(0, 8) });
    } catch {
      return reply.send({ suggestions: [] }); // autocomplete is best-effort
    }
  });
}
