import fp from "fastify-plugin";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { FastifyInstance } from "fastify";

// Publishes the OpenAPI contract at /docs (UI) and /docs/json — the source of
// truth both `web` and `ios` generate/validate their API clients against.
export default fp(async (fastify: FastifyInstance) => {
  await fastify.register(swagger, {
    openapi: {
      info: { title: "FilmJournal API", version: "0.1.0" },
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        },
      },
    },
  });
  await fastify.register(swaggerUi, { routePrefix: "/docs" });
});
