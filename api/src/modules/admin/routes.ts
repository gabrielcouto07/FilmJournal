import type { FastifyInstance, FastifyReply } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { getDatabaseReview } from "../../lib/db-review.js";
import { getTmdbFeed, getTmdbMovieWithImages, searchTmdbMovies, TmdbError, type TmdbFeed } from "../../lib/tmdb.js";
import { requireOwner } from "../../plugins/jwt.js";

function tmdbErrorResponse(reply: FastifyReply, error: unknown) {
  if (error instanceof TmdbError) {
    return reply.status(error.status).send({ error: error.message });
  }
  return reply.status(500).send({ error: "A busca está temporariamente indisponível. Tente novamente." });
}

export default async function adminRoutes(fastify: FastifyInstance) {
  fastify.get("/admin/stats", { preHandler: requireOwner }, async (request, reply) => {
    const userId = request.user!.id;
    const [movieCount, logCount, watchlistCount, favoriteCount] = await Promise.all([
      prisma.movie.count(),
      prisma.logEntry.count({ where: { userId } }),
      prisma.userMovie.count({ where: { userId, watchlist: true } }),
      prisma.userMovie.count({ where: { userId, favorite: true } }),
    ]);
    return reply.send({ movieCount, logCount, watchlistCount, favoriteCount });
  });

  fastify.get("/admin/db-review", { preHandler: requireOwner }, async (request, reply) => {
    try {
      const review = await getDatabaseReview();
      reply.header("Cache-Control", "private, no-store");
      return reply.send(review);
    } catch (error) {
      request.log.error(error, "Database review failed");
      return reply.status(500).send({ error: "Não foi possível gerar a revisão do banco de dados." });
    }
  });

  fastify.get<{ Querystring: { id?: string; q?: string; year?: string; page?: string; feed?: string } }>(
    "/tmdb",
    async (request, reply) => {
      const id = Number(request.query.id);
      const query = request.query.q?.trim() ?? "";
      const yearValue = Number(request.query.year);
      const pageValue = Number(request.query.page);
      const feed = (request.query.feed ?? null) as TmdbFeed | null;

      const viewer = request.user;
      const ownerId = viewer?.id || "";

      try {
        if (Number.isInteger(id) && id > 0) {
          const [movie, movieRecord, userMovie] = await Promise.all([
            getTmdbMovieWithImages(id),
            prisma.movie.findUnique({ where: { tmdbId: id }, select: { id: true, updatedAt: true } }),
            prisma.userMovie.findFirst({ where: { userId: ownerId, movie: { tmdbId: id } }, select: { watchlist: true, favoriteRank: true } }),
          ]);

          const existing = movieRecord
            ? {
                id: movieRecord.id,
                updatedAt: movieRecord.updatedAt,
                watchlist: userMovie?.watchlist ?? false,
                favoriteRank: userMovie?.favoriteRank ?? null,
              }
            : null;

          return reply.send({ movie, existing });
        }

        if (feed && ["trending", "popular", "now-playing", "top-rated", "upcoming"].includes(feed)) {
          const results = await getTmdbFeed(feed, Number.isInteger(pageValue) ? pageValue : 1);
          const ids = results.results.map((movie) => movie.id);

          const existingMovies = await prisma.movie.findMany({
            where: { tmdbId: { in: ids } },
            select: { id: true, tmdbId: true, updatedAt: true },
          });

          const existingIds = existingMovies.map((m) => m.id);
          const userMovies = await prisma.userMovie.findMany({
            where: { userId: ownerId, movieId: { in: existingIds } },
            select: { movieId: true, watchlist: true, favorite: true, favoriteRank: true },
          });
          const umMap = new Map(userMovies.map((um) => [um.movieId, um]));

          const existingById = new Map(
            existingMovies.map((m) => {
              const um = umMap.get(m.id);
              return [
                m.tmdbId,
                {
                  id: m.id,
                  tmdbId: m.tmdbId,
                  updatedAt: m.updatedAt,
                  watchlist: um?.watchlist ?? false,
                  favorite: um?.favorite ?? false,
                  favoriteRank: um?.favoriteRank ?? null,
                },
              ];
            }),
          );

          reply.header("Cache-Control", "private, max-age=300, stale-while-revalidate=21600");
          return reply.send({
            ...results,
            results: results.results.map((movie) => ({ ...movie, existing: existingById.get(movie.id) ?? null })),
          });
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

        const existingIds = existingMovies.map((m) => m.id);
        const userMovies = await prisma.userMovie.findMany({
          where: { userId: ownerId, movieId: { in: existingIds } },
          select: { movieId: true, watchlist: true, favorite: true, favoriteRank: true },
        });
        const umMap = new Map(userMovies.map((um) => [um.movieId, um]));

        const existingByTmdbId = new Map(
          existingMovies.map((m) => {
            const um = umMap.get(m.id);
            return [
              m.tmdbId,
              {
                id: m.id,
                tmdbId: m.tmdbId,
                updatedAt: m.updatedAt,
                watchlist: um?.watchlist ?? false,
                favorite: um?.favorite ?? false,
                favoriteRank: um?.favoriteRank ?? null,
              },
            ];
          }),
        );

        reply.header("Cache-Control", "private, max-age=30, stale-while-revalidate=120");
        return reply.send({
          ...results,
          results: results.results.map((movie) => ({
            ...movie,
            existing: existingByTmdbId.get(movie.id) ?? null,
          })),
        });
      } catch (error) {
        return tmdbErrorResponse(reply, error);
      }
    },
  );
}
