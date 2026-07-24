import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { getTmdbMovieWithImages, getPosterUrl, TmdbError } from "../../lib/tmdb.js";
import { upsertEnrichedMovie, enrichMovieMetadata } from "../../lib/movie-metadata.js";
import { CATALOG_TAG, userTag } from "../../lib/dashboard-data.js";
import { revalidateTag } from "../../lib/cache.js";
import { requireAuth } from "../../plugins/jwt.js";

async function setFavoriteRank(userId: string, movieId: string, rank: number | null) {
  return prisma.$transaction(async (transaction) => {
    const movie = await transaction.movie.findUnique({ where: { id: movieId } });
    if (!movie) throw new TmdbError("Movie not found.", 404);

    const userMovie = await transaction.userMovie.upsert({
      where: { userId_movieId: { userId, movieId } },
      create: { userId, movieId },
      update: {},
    });

    if (rank == null) {
      return transaction.userMovie.update({
        where: { userId_movieId: { userId, movieId } },
        data: { favoriteRank: null },
      });
    }

    const occupant = await transaction.userMovie.findFirst({
      where: { userId, favoriteRank: rank },
    });

    if (userMovie.favoriteRank === rank) return userMovie;

    // Release the current position before reshuffling the ranking.
    await transaction.userMovie.update({
      where: { userId_movieId: { userId, movieId } },
      data: { favoriteRank: null },
    });

    if (occupant && occupant.movieId !== movieId) {
      await transaction.userMovie.update({
        where: { userId_movieId: { userId, movieId: occupant.movieId } },
        data: { favoriteRank: userMovie.favoriteRank ?? null },
      });
    }

    return transaction.userMovie.update({
      where: { userId_movieId: { userId, movieId } },
      data: { favoriteRank: rank },
    });
  });
}

type CollectionMutation = {
  movieId?: unknown;
  action?: unknown;
  value?: unknown;
  rank?: unknown;
};

export default async function moviesRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: { q?: string; watchlist?: string; limit?: string } }>("/movies", async (request, reply) => {
    const query = request.query.q?.trim() ?? "";
    const watchlist = request.query.watchlist === "true";
    const limit = Math.min(Math.max(Number(request.query.limit) || 40, 1), 100);

    const ownerId = request.user?.id || "";

    let movies: unknown[] = [];

    if (watchlist) {
      const userMovies = await prisma.userMovie.findMany({
        where: {
          userId: ownerId,
          watchlist: true,
          ...(query ? { movie: { title: { contains: query } } } : {}),
        },
        include: {
          movie: {
            include: {
              logs: {
                where: { userId: ownerId },
                orderBy: [{ watchedAt: "desc" }, { loggedAt: "desc" }],
                take: 1,
              },
            },
          },
        },
        orderBy: [{ watchlistAddedAt: "desc" }, { updatedAt: "desc" }],
        take: limit,
      });
      movies = userMovies.map((um) => ({
        ...um.movie,
        rating: um.rating,
        watched: um.watched,
        favorite: um.favorite,
        watchlist: um.watchlist,
        watchlistAddedAt: um.watchlistAddedAt,
        favoriteRank: um.favoriteRank,
      }));
    } else {
      // The user's state is already returned by this same query.
      const rawMovies = await prisma.movie.findMany({
        where: query ? { title: { contains: query } } : {},
        include: {
          logs: {
            where: { userId: ownerId },
            orderBy: [{ watchedAt: "desc" }, { loggedAt: "desc" }],
            take: 1,
          },
          userMovies: { where: { userId: ownerId } },
        },
        orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
        take: limit,
      });

      movies = rawMovies.map((m) => {
        const um = m.userMovies[0];
        return {
          ...m,
          userMovies: undefined,
          rating: um?.rating ?? null,
          watched: um?.watched ?? false,
          favorite: um?.favorite ?? false,
          watchlist: um?.watchlist ?? false,
          watchlistAddedAt: um?.watchlistAddedAt ?? null,
          favoriteRank: um?.favoriteRank ?? null,
        };
      });
    }

    return reply.send({ movies });
  });

  fastify.post<{ Body: { tmdbId?: unknown; watchlist?: unknown } }>(
    "/movies",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.user!;
      const body = request.body ?? {};

      const tmdbId = Number(body.tmdbId);
      if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
        return reply.status(400).send({ error: "Um tmdbId válido é obrigatório." });
      }

      try {
        // Persist the TMDB metadata and the relations used by analytics.
        const { movie, created } = await upsertEnrichedMovie(tmdbId);

        // Create or update the movie's link to the user.
        const userMovie = await prisma.userMovie.upsert({
          where: { userId_movieId: { userId: user.id, movieId: movie.id } },
          create: {
            userId: user.id,
            movieId: movie.id,
            watchlist: body.watchlist === true,
            watchlistAddedAt: body.watchlist === true ? new Date() : null,
          },
          update:
            typeof body.watchlist === "boolean"
              ? { watchlist: body.watchlist, watchlistAddedAt: body.watchlist ? new Date() : null }
              : {},
        });

        const mergedMovie = {
          ...movie,
          rating: userMovie.rating,
          watched: userMovie.watched,
          favorite: userMovie.favorite,
          watchlist: userMovie.watchlist,
          watchlistAddedAt: userMovie.watchlistAddedAt,
          favoriteRank: userMovie.favoriteRank,
        };

        revalidateTag(userTag(user.id));
        // The catalog is shared, so clear the pages that display this movie.
        revalidateTag(CATALOG_TAG);
        return reply.status(created ? 201 : 200).send({
          movie: mergedMovie,
          created,
          message: created ? `${movie.title} foi adicionado ao seu diário.` : `Os metadados de ${movie.title} estão atualizados.`,
        });
      } catch (error) {
        if (error instanceof TmdbError) {
          return reply.status(error.status).send({ error: error.message });
        }
        return reply.status(500).send({ error: "Não foi possível salvar este filme. Tente novamente." });
      }
    },
  );

  fastify.patch<{ Body: CollectionMutation }>("/movies", { preHandler: requireAuth }, async (request, reply) => {
    const user = request.user!;
    const body = request.body;

    if (typeof body.movieId !== "string" || !body.movieId || typeof body.action !== "string") {
      return reply.status(400).send({ error: "movieId e action são obrigatórios." });
    }

    const movieId = body.movieId;

    try {
      if (body.action === "watchlist") {
        if (typeof body.value !== "boolean") {
          return reply.status(400).send({ error: "As atualizações da lista para assistir exigem um valor booleano." });
        }
        const existing = await prisma.movie.findUnique({ where: { id: movieId } });
        if (!existing) return reply.status(404).send({ error: "Filme não encontrado." });

        const userMovie = await prisma.userMovie.upsert({
          where: { userId_movieId: { userId: user.id, movieId } },
          create: { userId: user.id, movieId, watchlist: body.value, watchlistAddedAt: body.value ? new Date() : null },
          update: { watchlist: body.value, watchlistAddedAt: body.value ? new Date() : null },
        });

        const mergedMovie = {
          ...existing,
          rating: userMovie.rating,
          watched: userMovie.watched,
          favorite: userMovie.favorite,
          watchlist: userMovie.watchlist,
          watchlistAddedAt: userMovie.watchlistAddedAt,
          favoriteRank: userMovie.favoriteRank,
        };

        revalidateTag(userTag(user.id));
        return reply.send({
          movie: mergedMovie,
          message: body.value ? "Adicionado à sua lista para assistir." : "Removido da sua lista para assistir.",
        });
      }

      if (body.action === "poster" || body.action === "backdrop") {
        if (user.role !== "OWNER") {
          return reply.status(403).send({ error: "A arte do catálogo só pode ser alterada pelo proprietário." });
        }
        if (typeof body.value !== "string" || !body.value.startsWith("/") || body.value.length > 200) {
          return reply.status(400).send({ error: "É necessário um caminho de arte válido do TMDb." });
        }
        const existing = await prisma.movie.findUnique({ where: { id: movieId } });
        if (!existing) return reply.status(404).send({ error: "Filme não encontrado." });
        if (!existing.tmdbId) return reply.status(409).send({ error: "Este filme não possui uma coleção de artes no TMDb." });
        const details = await getTmdbMovieWithImages(existing.tmdbId);
        const images = body.action === "poster" ? details.images?.posters ?? [] : details.images?.backdrops ?? [];
        const defaultPath = body.action === "poster" ? details.poster_path : details.backdrop_path;
        const allowed = new Set([defaultPath, ...images.map((image) => image.file_path)]);
        if (!allowed.has(body.value)) return reply.status(400).send({ error: `Este ${body.action} não está disponível para este filme.` });

        const movie = await prisma.movie.update({
          where: { id: movieId },
          data: body.action === "poster" ? { preferredPosterPath: body.value } : { preferredBackdropPath: body.value },
        });

        const userMovie = await prisma.userMovie.findUnique({ where: { userId_movieId: { userId: user.id, movieId } } });

        const mergedMovie = {
          ...movie,
          rating: userMovie?.rating ?? null,
          watched: userMovie?.watched ?? false,
          favorite: userMovie?.favorite ?? false,
          watchlist: userMovie?.watchlist ?? false,
          watchlistAddedAt: userMovie?.watchlistAddedAt ?? null,
          favoriteRank: userMovie?.favoriteRank ?? null,
        };

        revalidateTag(CATALOG_TAG); // shared catalog artwork affects every user's cached pages
        return reply.send({ movie: mergedMovie, message: `${body.action === "poster" ? "Pôster" : "Fundo"} atualizado em todo o seu arquivo.` });
      }

      if (body.action === "favorite") {
        if (typeof body.value !== "boolean") {
          return reply.status(400).send({ error: "As atualizações de favorito exigem um valor booleano." });
        }

        const existing = await prisma.movie.findUnique({ where: { id: movieId } });
        if (!existing) return reply.status(404).send({ error: "Filme não encontrado." });

        const userMovie = await prisma.userMovie.upsert({
          where: { userId_movieId: { userId: user.id, movieId } },
          create: { userId: user.id, movieId, favorite: body.value },
          update: { favorite: body.value },
        });

        const mergedMovie = {
          ...existing,
          rating: userMovie.rating,
          watched: userMovie.watched,
          favorite: userMovie.favorite,
          watchlist: userMovie.watchlist,
          watchlistAddedAt: userMovie.watchlistAddedAt,
          favoriteRank: userMovie.favoriteRank,
        };

        revalidateTag(userTag(user.id));
        return reply.send({ movie: mergedMovie, message: body.value ? "Adicionado aos filmes favoritos." : "Removido dos filmes favoritos." });
      }

      if (body.action === "top10") {
        if (typeof body.value !== "boolean") return reply.status(400).send({ error: "As atualizações do Top 10 exigem um valor booleano." });
        const existing = await prisma.movie.findUnique({ where: { id: movieId } });
        if (!existing) return reply.status(404).send({ error: "Filme não encontrado." });

        if (!body.value) {
          const userMovie = await setFavoriteRank(user.id, movieId, null);
          const mergedMovie = {
            ...existing,
            rating: userMovie.rating,
            watched: userMovie.watched,
            favorite: userMovie.favorite,
            watchlist: userMovie.watchlist,
            watchlistAddedAt: userMovie.watchlistAddedAt,
            favoriteRank: userMovie.favoriteRank,
          };
          revalidateTag(userTag(user.id));
          return reply.send({ movie: mergedMovie, message: "Removido do seu Top 10." });
        }

        const occupiedRanks = await prisma.userMovie.findMany({
          where: { userId: user.id, favoriteRank: { not: null } },
          select: { favoriteRank: true },
        });
        const nextRank = Array.from({ length: 10 }, (_, index) => index + 1).find((rank) => !occupiedRanks.some((um) => um.favoriteRank === rank));
        if (!nextRank) return reply.status(409).send({ error: "Seu Top 10 está cheio. Reordene ou remova um filme primeiro." });

        const userMovie = await setFavoriteRank(user.id, movieId, nextRank);

        const mergedMovie = {
          ...existing,
          rating: userMovie.rating,
          watched: userMovie.watched,
          favorite: userMovie.favorite,
          watchlist: userMovie.watchlist,
          watchlistAddedAt: userMovie.watchlistAddedAt,
          favoriteRank: userMovie.favoriteRank,
        };

        revalidateTag(userTag(user.id));
        return reply.send({ movie: mergedMovie, message: `Adicionado ao seu Top 10 na posição #${nextRank}.` });
      }

      if (body.action === "favoriteRank") {
        const rank = body.rank == null ? null : Number(body.rank);
        if (rank !== null && (!Number.isInteger(rank) || rank < 1 || rank > 10)) {
          return reply.status(400).send({ error: "A posição de favorito deve estar entre 1 e 10." });
        }

        const existing = await prisma.movie.findUnique({ where: { id: movieId } });
        if (!existing) return reply.status(404).send({ error: "Filme não encontrado." });

        const userMovie = await setFavoriteRank(user.id, movieId, rank);

        const mergedMovie = {
          ...existing,
          rating: userMovie.rating,
          watched: userMovie.watched,
          favorite: userMovie.favorite,
          watchlist: userMovie.watchlist,
          watchlistAddedAt: userMovie.watchlistAddedAt,
          favoriteRank: userMovie.favoriteRank,
        };

        revalidateTag(userTag(user.id));
        return reply.send({ movie: mergedMovie, message: rank ? `Movido para #${rank}.` : "Removido do seu Top 10." });
      }

      if (body.action === "rating") {
        const rating = body.value === null ? null : Number(body.value);
        if (rating !== null && (!Number.isFinite(rating) || rating < 0.5 || rating > 5 || rating * 2 !== Math.round(rating * 2))) {
          return reply.status(400).send({ error: "A nota deve ser um valor de meia estrela, de 0,5 a 5." });
        }

        const existing = await prisma.movie.findUnique({ where: { id: movieId } });
        if (!existing) return reply.status(404).send({ error: "Filme não encontrado." });

        const userMovie = await prisma.userMovie.upsert({
          where: { userId_movieId: { userId: user.id, movieId } },
          create: { userId: user.id, movieId, rating },
          update: { rating },
        });

        const mergedMovie = {
          ...existing,
          rating: userMovie.rating,
          watched: userMovie.watched,
          favorite: userMovie.favorite,
          watchlist: userMovie.watchlist,
          watchlistAddedAt: userMovie.watchlistAddedAt,
          favoriteRank: userMovie.favoriteRank,
        };

        revalidateTag(userTag(user.id));
        return reply.send({ movie: mergedMovie, message: rating ? `Nota ${rating.toFixed(1)} estrelas.` : "Nota removida." });
      }

      return reply.status(400).send({ error: "Ação de coleção não suportada." });
    } catch (error) {
      if (error instanceof TmdbError) return reply.status(error.status).send({ error: error.message });
      return reply.status(500).send({ error: "Não foi possível atualizar esta coleção." });
    }
  });

  const NO_CHANGE_COOLDOWN_MS = 6 * 60 * 60 * 1000;
  const noChangeAttempts = new Map<string, number>();
  function underCooldown(movieId: string): boolean {
    const lastAttempt = noChangeAttempts.get(movieId);
    return lastAttempt !== undefined && Date.now() - lastAttempt < NO_CHANGE_COOLDOWN_MS;
  }

  /** Backfills metadata in the background and reports whether pages need refreshing. */
  fastify.post<{ Body: { movieIds?: unknown; limit?: unknown } }>(
    "/movies/enrich",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.user!;
      const body = request.body ?? {};

      let ids: string[];
      if (Array.isArray(body.movieIds)) {
        // The movie page always gets a fresh attempt.
        ids = body.movieIds.filter((value): value is string => typeof value === "string").slice(0, 20);
      } else {
        const limit = Math.min(Math.max(Number(body.limit) || 12, 1), 20);
        // Fetch extra candidates so we can skip the ones still on cooldown.
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
          request.log.error({ err: error, movieId: id }, "[movies/enrich]");
        }
      }

      request.log.info(`[enrich] requested=${ids.length} enriched=${enriched} in ${Math.round(performance.now() - start)}ms`);

      // Clear the cache for pages showing the updated metadata.
      if (enriched > 0) revalidateTag(CATALOG_TAG);
      return reply.send({ enriched, requested: ids.length });
    },
  );

  fastify.post<{ Body: { movieId?: unknown; title?: unknown } }>(
    "/movies/artwork",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.user!;
      const body = request.body ?? {};
      const movieId = typeof body.movieId === "string" && body.movieId ? body.movieId : null;
      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!movieId && !title) {
        return reply.status(400).send({ error: "movieId ou título é obrigatório." });
      }

      const owned = await prisma.movie.findFirst({
        where: {
          ...(movieId ? { id: movieId } : { title }),
          OR: [{ userMovies: { some: { userId: user.id } } }, { logs: { some: { userId: user.id } } }],
        },
        select: { id: true },
      });
      if (!owned) return reply.status(404).send({ error: "Filme não encontrado na sua coleção." });

      try {
        const movie = await enrichMovieMetadata(owned.id);
        const posterUrl = getPosterUrl(movie?.preferredPosterPath ?? movie?.posterPath);
        if (!posterUrl) return reply.status(404).send({ error: "O TMDB não encontrou uma capa para este filme." });
        revalidateTag(CATALOG_TAG); // enrichment updates the shared catalog
        return reply.send({ posterUrl });
      } catch (error) {
        request.log.error(error, "[movies/artwork]");
        return reply.status(502).send({ error: "Não foi possível buscar esta capa agora." });
      }
    },
  );
}
