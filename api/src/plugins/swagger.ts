import fp from "fastify-plugin";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { FastifyInstance } from "fastify";

// Contrato OpenAPI em /docs e /docs/json: é a fonte da verdade dos clientes da API.
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
