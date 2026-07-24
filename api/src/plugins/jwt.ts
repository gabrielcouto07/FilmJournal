import fp from "fastify-plugin";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export type AuthUser = {
  id: string;
  username: string;
  displayName: string | null;
  role: "OWNER" | "USER";
  email: string;
};

type AccessTokenClaims = AuthUser & { type: "access" };
type RefreshTokenClaims = { sub: string; type: "refresh" };

declare module "fastify" {
  interface FastifyRequest {
    user: AuthUser | null;
  }
  interface FastifyInstance {
    signAccessToken(user: AuthUser): string;
    signRefreshToken(userId: string): string;
    verifyRefreshToken(token: string): string | null;
  }
}

/**
 * Stateless JWT auth, replacing web's NextAuth cookie sessions so both `web`
 * and `ios` authenticate against this API the same way (Bearer access token +
 * refresh token), instead of iOS having to replay NextAuth's cookie dance.
 */
export default fp(async (fastify: FastifyInstance) => {
  fastify.decorate("signAccessToken", (user: AuthUser): string => {
    const claims: AccessTokenClaims = { ...user, type: "access" };
    return jwt.sign(claims, env.JWT_SECRET, { expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions["expiresIn"] });
  });

  fastify.decorate("signRefreshToken", (userId: string): string => {
    const claims: RefreshTokenClaims = { sub: userId, type: "refresh" };
    return jwt.sign(claims, env.JWT_SECRET, { expiresIn: env.JWT_REFRESH_TTL as jwt.SignOptions["expiresIn"] });
  });

  fastify.decorate("verifyRefreshToken", (token: string): string | null => {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as RefreshTokenClaims;
      if (payload.type !== "refresh") return null;
      return payload.sub;
    } catch {
      return null;
    }
  });

  fastify.decorateRequest("user", null);

  fastify.addHook("preHandler", async (request: FastifyRequest) => {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) return;
    try {
      const payload = jwt.verify(header.slice(7), env.JWT_SECRET) as AccessTokenClaims;
      if (payload.type === "access") {
        request.user = { id: payload.id, username: payload.username, displayName: payload.displayName, role: payload.role, email: payload.email };
      }
    } catch {
      // Invalid/expired token: leave request.user null, let route guards reject.
    }
  });
});

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) {
    return reply.status(401).send({ error: "Não autenticado." });
  }
}

export async function requireOwner(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) {
    return reply.status(401).send({ error: "Não autenticado." });
  }
  if (request.user.role !== "OWNER") {
    return reply.status(403).send({ error: "Acesso restrito ao proprietário." });
  }
}
