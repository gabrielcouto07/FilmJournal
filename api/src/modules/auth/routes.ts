import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { isRateLimited } from "../../lib/rate-limit.js";
import { requireAuth } from "../../plugins/jwt.js";
import { loginSchema, registerSchema, refreshSchema } from "./schema.js";
import {
  login,
  register,
  getUserById,
  InvalidCredentialsError,
  UsernameReservedError,
  UsernameOrEmailTakenError,
} from "./service.js";

function clientIp(request: { headers: Record<string, unknown>; ip: string }): string {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0]?.trim() || request.ip;
  return request.ip;
}

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post("/auth/login", async (request, reply) => {
    const ip = clientIp(request);
    if (await isRateLimited(`login:${ip}`, { max: 10, windowMs: 10 * 60 * 1000 })) {
      return reply.status(429).send({ error: "Muitas tentativas. Aguarde alguns minutos." });
    }

    try {
      const { username, password } = loginSchema.parse(request.body);
      const user = await login(username, password);
      const accessToken = fastify.signAccessToken(user);
      const refreshToken = fastify.signRefreshToken(user.id);
      return reply.send({ accessToken, refreshToken, user });
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: "Dados inválidos.", details: err.errors });
      }
      if (err instanceof InvalidCredentialsError) {
        return reply.status(401).send({ error: "Usuário ou senha inválidos." });
      }
      throw err;
    }
  });

  fastify.post("/auth/refresh", async (request, reply) => {
    const { refreshToken } = refreshSchema.parse(request.body);
    const userId = fastify.verifyRefreshToken(refreshToken);
    if (!userId) return reply.status(401).send({ error: "Token de atualização inválido ou expirado." });

    const user = await getUserById(userId);
    if (!user) return reply.status(401).send({ error: "Usuário não encontrado." });

    return reply.send({ accessToken: fastify.signAccessToken(user), user });
  });

  fastify.get("/auth/me", { preHandler: requireAuth }, async (request, reply) => {
    return reply.send({ user: request.user });
  });

  fastify.post("/auth/register", async (request, reply) => {
    // Sem checagem de CSRF: a API usa Bearer token, que o navegador nunca envia
    // sozinho — não há credencial ambiente para um site malicioso explorar.
    const ip = clientIp(request);
    if (await isRateLimited(`register:${ip}`, { max: 5, windowMs: 10 * 60 * 1000 })) {
      return reply.status(429).send({ error: "Muitas tentativas. Aguarde alguns minutos." });
    }

    try {
      const data = registerSchema.parse(request.body);
      const user = await register(data);
      // Auto-login: a conta recém-criada já sai autenticada, igual ao /auth/login.
      const accessToken = fastify.signAccessToken(user);
      const refreshToken = fastify.signRefreshToken(user.id);
      return reply.status(201).send({ accessToken, refreshToken, user });
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: "Dados inválidos.", details: err.errors });
      }
      if (err instanceof UsernameReservedError) {
        return reply.status(409).send({ error: "Esse nome de usuário é reservado." });
      }
      if (err instanceof UsernameOrEmailTakenError) {
        return reply.status(409).send({ error: err.field === "username" ? "Nome de usuário já em uso." : "E-mail já cadastrado." });
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return reply.status(409).send({ error: "Nome de usuário ou e-mail já cadastrado." });
      }
      fastify.log.error(err, "[register]");
      return reply.status(500).send({ error: "Erro interno." });
    }
  });
}
