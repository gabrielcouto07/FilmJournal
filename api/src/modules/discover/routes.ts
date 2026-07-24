import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { dismissBlindSpot, getDiscoverPicks } from "../../lib/discover.js";
import { getTasteData } from "../../lib/recommendations.js";
import { DIMENSION_ORDER, type GapDimension } from "../../lib/analytics/blindspots.js";
import { requireAuth } from "../../plugins/jwt.js";

const dismissSchema = z.object({
  dimension: z.enum(["decade", "country", "language", "genre"]),
  // Usa a chave da faixa ou "*" para ocultar a dimensão inteira.
  gapKey: z.string().trim().min(1).max(20),
});

export default async function discoverRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: { dimension?: string } }>(
    "/discover",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.user!;
      const raw = request.query.dimension;
      const focus = DIMENSION_ORDER.includes(raw as GapDimension) ? (raw as GapDimension) : undefined;

      try {
        return reply.send(await getDiscoverPicks(user.id, focus));
      } catch (error) {
        request.log.error(error, "[discover] failed");
        return reply.status(502).send({ error: "Não foi possível calcular seus pontos cegos agora." });
      }
    },
  );

  fastify.post<{ Body: { dimension?: unknown; gapKey?: unknown } }>(
    "/discover/dismiss",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.user!;

      const parsed = dismissSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: "Dados inválidos." });

      await dismissBlindSpot(user.id, parsed.data.dimension, parsed.data.gapKey);
      return reply.send({ ok: true, message: "Não vamos mais sugerir essa lacuna." });
    },
  );

  fastify.get<{ Querystring: { refresh?: string } }>(
    "/recommendations",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.user!;

      try {
        const data = await getTasteData({ refresh: request.query.refresh === "1", userId: user.id });
        return reply.header("Cache-Control", "private, no-store").send(data);
      } catch (error) {
        request.log.error(error, "Recommendation refresh failed");
        return reply.status(503).send({ error: "Não foi possível atualizar sua curadoria no momento." });
      }
    },
  );
}
