import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { getBlindSpotPool } from "../../lib/discover.js";
import {
  discoverTmdbMovies,
  getTmdbGenres,
  getTmdbMovieLocalized,
  searchTmdbPeople,
  TmdbError,
  type TmdbMovieSearchResult,
} from "../../lib/tmdb.js";
import { requireAuth } from "../../plugins/jwt.js";

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

function sendTmdbError(reply: FastifyReply, error: unknown) {
  if (error instanceof TmdbError) {
    return reply.status(error.status).send({ error: error.message, status: error.status });
  }
  return reply.status(502).send({ error: "Serviço temporariamente indisponível. Tente novamente.", status: 502 });
}

// Guarda os últimos filtros da roleta para a próxima visita.
const prefsSchema = z.object({
  source: z.enum(["popular", "watchlist", "blindspots"]),
  genres: z.array(z.number().int().positive()).max(10),
  people: z.array(z.object({ id: z.number().int().positive(), name: z.string().trim().min(1).max(80) })).max(5),
  yearFrom: z.string().regex(/^\d{0,4}$/),
  yearTo: z.string().regex(/^\d{0,4}$/),
  runtimeMax: z.number().int().min(60).max(240),
  count: z.union([z.literal(4), z.literal(8), z.literal(16)]),
});

export type RoulettePrefs = z.infer<typeof prefsSchema>;

type RouletteDiscoverQuery = {
  movieId?: string;
  source?: string;
  genres?: string;
  people?: string;
  yearFrom?: string;
  yearTo?: string;
  runtimeMax?: string;
  count?: string;
};

export default async function rouletteRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: RouletteDiscoverQuery }>("/roulette/discover", async (request, reply) => {
    const query = request.query;

    // Detalhes completos do filme sorteado.
    const movieIdParam = Number(query.movieId);
    if (Number.isInteger(movieIdParam) && movieIdParam > 0) {
      try {
        const movie = await getTmdbMovieLocalized(movieIdParam, LANGUAGE);
        return reply.send({
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
        return sendTmdbError(reply, error);
      }
    }

    // Monta uma amostra embaralhada com `count` filmes.
    const source = query.source ?? "popular";
    const genres = (query.genres ?? "").split(",").map((g) => g.trim()).filter(Boolean);
    const people = (query.people ?? "").split(",").map((p) => p.trim()).filter(Boolean);
    const yearFrom = Number(query.yearFrom);
    const yearTo = Number(query.yearTo);
    const runtimeMax = Number(query.runtimeMax);
    const requestedCount = Number(query.count);
    const count = ALLOWED_COUNTS.includes(requestedCount) ? requestedCount : 8;

    // Fontes pessoais exigem uma sessão ativa.
    if (source === "watchlist" || source === "blindspots") {
      const user = request.user;
      if (!user) return reply.status(401).send({ error: "Faça login para usar esta fonte." });

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
          return reply.send({ movies: pool, totalResults: pool.length });
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
        return reply.send({ movies: pool, totalResults: filtered.length });
      } catch (error) {
        return sendTmdbError(reply, error);
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
      return reply.send({ movies: pool, totalResults: result.total_results });
    } catch (error) {
      return sendTmdbError(reply, error);
    }
  });

  fastify.get("/roulette/genres", async (request, reply) => {
    try {
      const genres = await getTmdbGenres("pt-BR");
      // A lista muda pouco, então pode ficar bastante tempo em cache.
      return reply.header("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800").send({ genres });
    } catch (error) {
      return sendTmdbError(reply, error);
    }
  });

  fastify.get<{ Querystring: { q?: string } }>("/roulette/people", async (request, reply) => {
    const query = request.query.q?.trim() ?? "";
    if (query.length < 2) {
      return reply.send({ people: [] });
    }

    try {
      const people = await searchTmdbPeople(query, "pt-BR");
      return reply.send({
        people: people.map((person) => ({
          id: person.id,
          name: person.name,
          department: person.known_for_department ?? null,
          knownFor: (person.known_for ?? [])
            .map((item) => item.title || item.name)
            .filter(Boolean)
            .slice(0, 2),
        })),
      });
    } catch (error) {
      return sendTmdbError(reply, error);
    }
  });

  fastify.get("/roulette/prefs", { preHandler: requireAuth }, async (request, reply) => {
    const user = request.user!;
    const settings = await prisma.userSettings.findUnique({ where: { userId: user.id }, select: { rouletteFilters: true } });
    const parsed = prefsSchema.safeParse(settings?.rouletteFilters);
    return reply.send({ prefs: parsed.success ? parsed.data : null });
  });

  fastify.put<{ Body: unknown }>("/roulette/prefs", { preHandler: requireAuth }, async (request, reply) => {
    const user = request.user!;

    const parsed = prefsSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Filtros inválidos." });

    await prisma.userSettings.upsert({
      where: { userId: user.id },
      create: { userId: user.id, rouletteFilters: parsed.data },
      update: { rouletteFilters: parsed.data },
    });
    return reply.send({ ok: true });
  });
}
