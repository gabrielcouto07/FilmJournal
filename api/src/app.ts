import Fastify from "fastify";
import prismaPlugin from "./plugins/prisma.js";
import corsPlugin from "./plugins/cors.js";
import rateLimitPlugin from "./plugins/rate-limit.js";
import jwtPlugin from "./plugins/jwt.js";
import swaggerPlugin from "./plugins/swagger.js";
import authRoutes from "./modules/auth/routes.js";
import moviesRoutes from "./modules/movies/routes.js";
import accountRoutes from "./modules/account/routes.js";
import profileRoutes from "./modules/profile/routes.js";
import discoverRoutes from "./modules/discover/routes.js";
import rouletteRoutes from "./modules/roulette/routes.js";
import adminRoutes from "./modules/admin/routes.js";
import dashboardRoutes from "./modules/dashboard/routes.js";
import playRoutes from "./modules/play/routes.js";
import logsRoutes from "./modules/logs/routes.js";
import listsRoutes from "./modules/lists/routes.js";

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(prismaPlugin);
  await app.register(corsPlugin);
  await app.register(rateLimitPlugin);
  await app.register(jwtPlugin);
  await app.register(swaggerPlugin);

  app.get("/health", async () => ({ status: "ok" }));

  await app.register(authRoutes);
  await app.register(moviesRoutes);
  await app.register(accountRoutes);
  await app.register(profileRoutes);
  await app.register(discoverRoutes);
  await app.register(rouletteRoutes);
  await app.register(adminRoutes);
  await app.register(dashboardRoutes);
  await app.register(playRoutes);
  await app.register(logsRoutes);
  await app.register(listsRoutes);

  return app;
}
