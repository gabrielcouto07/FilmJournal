import type { FastifyInstance } from "fastify";
import {
  getDashboardData,
  getDiaryData,
  getWatchlistData,
  getFavoritesData,
  getStatsData,
  getPalateData,
  getTimelineData,
  getMotifsData,
} from "../../lib/dashboard-data.js";
import { computeVerdict } from "../../lib/analytics/verdict.js";
import { requireAuth } from "../../plugins/jwt.js";

/** Leituras autenticadas das páginas de análise (painel, diário, listas, paladar, evolução). */
export default async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.get("/dashboard", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const data = await getDashboardData(request.user!.id);
      return reply.send(data);
    } catch (error) {
      request.log.error(error, "[dashboard] failed");
      return reply.status(500).send({ error: "Não foi possível carregar o painel." });
    }
  });

  fastify.get("/diary", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const data = await getDiaryData(request.user!.id);
      return reply.send(data);
    } catch (error) {
      request.log.error(error, "[diary] failed");
      return reply.status(500).send({ error: "Não foi possível carregar o diário." });
    }
  });

  fastify.get("/watchlist", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const data = await getWatchlistData(request.user!.id);
      return reply.send(data);
    } catch (error) {
      request.log.error(error, "[watchlist] failed");
      return reply.status(500).send({ error: "Não foi possível carregar a lista para assistir." });
    }
  });

  fastify.get("/favorites", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const data = await getFavoritesData(request.user!.id);
      return reply.send(data);
    } catch (error) {
      request.log.error(error, "[favorites] failed");
      return reply.status(500).send({ error: "Não foi possível carregar os favoritos." });
    }
  });

  fastify.get("/stats", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const data = await getStatsData(request.user!.id);
      return reply.send(data);
    } catch (error) {
      request.log.error(error, "[stats] failed");
      return reply.status(500).send({ error: "Não foi possível carregar as estatísticas." });
    }
  });

  fastify.get("/palate", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const data = await getPalateData(request.user!.id);
      // O veredito deriva dos mesmos sinais do paladar, então viaja junto.
      const verdict = computeVerdict({
        totalFilms: data.totalFilms,
        contrarian: data.contrarian,
        decades: data.decades,
        genres: data.genres,
        directors: data.directors,
      });
      return reply.send({ ...data, verdict });
    } catch (error) {
      request.log.error(error, "[palate] failed");
      return reply.status(500).send({ error: "Não foi possível carregar seu paladar." });
    }
  });

  fastify.get("/timeline", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const data = await getTimelineData(request.user!.id);
      return reply.send(data);
    } catch (error) {
      request.log.error(error, "[timeline] failed");
      return reply.status(500).send({ error: "Não foi possível carregar a linha do tempo." });
    }
  });

  fastify.get("/motifs", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const data = await getMotifsData(request.user!.id);
      return reply.send(data);
    } catch (error) {
      request.log.error(error, "[motifs] failed");
      return reply.status(500).send({ error: "Não foi possível carregar os motivos recorrentes." });
    }
  });
}
