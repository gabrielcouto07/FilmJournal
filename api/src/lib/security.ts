import type { FastifyReply, FastifyRequest } from "fastify";

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Blocks cookie-authenticated mutations when the request origin differs from the host. */
export function isSameOrigin(request: FastifyRequest): boolean {
  const origin = firstHeaderValue(request.headers.origin);
  if (!origin) return true;
  const host = firstHeaderValue(request.headers["x-forwarded-host"]) ?? firstHeaderValue(request.headers.host);
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function sendCrossOriginError(reply: FastifyReply) {
  return reply.status(403).send({ error: "Requisição de origem não permitida." });
}
