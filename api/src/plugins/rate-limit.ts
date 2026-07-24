import fp from "fastify-plugin";
import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";

// Global outer bound; per-route limits (login, register, imports) use
// ../lib/rate-limit.ts's Postgres-backed limiter for tighter, keyed windows.
export default fp(async (fastify: FastifyInstance) => {
  await fastify.register(rateLimit, {
    max: 300,
    timeWindow: "1 minute",
  });
});
