import fp from "fastify-plugin";
import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";

// Limite global; login, registro e importação usam o limitador em Postgres de ../lib/rate-limit.ts.
export default fp(async (fastify: FastifyInstance) => {
  await fastify.register(rateLimit, {
    max: 300,
    timeWindow: "1 minute",
  });
});
