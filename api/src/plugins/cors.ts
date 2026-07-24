import fp from "fastify-plugin";
import cors from "@fastify/cors";
import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";

const allowed = env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean);

// Em desenvolvimento o Next pode trocar de porta (3000 ocupada → 3001);
// aceitar qualquer localhost evita o navegador cair em "Failed to fetch".
const LOCALHOST = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export default fp(async (fastify: FastifyInstance) => {
  await fastify.register(cors, {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // curl, apps nativos, same-origin
      if (allowed.includes(origin)) return callback(null, true);
      if (env.NODE_ENV !== "production" && LOCALHOST.test(origin)) return callback(null, true);
      callback(new Error("Origem não permitida."), false);
    },
    credentials: true,
  });
});
