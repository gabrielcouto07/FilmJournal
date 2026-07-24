import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { requireAuth } from "../../plugins/jwt.js";

type ListParams = { listId: string };
type ListQuery = { movieId?: string };
type ListBody = {
  name?: unknown;
  description?: unknown;
  isPublic?: unknown;
};
type ListMovieBody = { movieId?: unknown };

function requiredName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return name && name.length <= 120 ? name : null;
}

function optionalDescription(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const description = value.trim();
  return description.length <= 1000 ? description || null : undefined;
}

export default async function listsRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: ListQuery }>(
    "/lists",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.user!;
      const movieId = request.query.movieId?.trim() || null;

      const [lists, memberships] = await Promise.all([
        prisma.movieList.findMany({
          where: { userId: user.id },
          include: {
            _count: { select: { movies: true } },
            movies: {
              take: 4,
              orderBy: { addedAt: "desc" },
              include: {
                movie: {
                  select: {
                    id: true,
                    title: true,
                    posterPath: true,
                    preferredPosterPath: true,
                  },
                },
              },
            },
          },
          orderBy: { updatedAt: "desc" },
        }),
        movieId
          ? prisma.movieListMovie.findMany({
              where: { movieId, list: { userId: user.id } },
              select: { listId: true },
            })
          : Promise.resolve([]),
      ]);

      const containingLists = new Set(memberships.map(({ listId }) => listId));
      return reply.send({
        lists: lists.map((list) => ({
          ...list,
          containsMovie: movieId ? containingLists.has(list.id) : false,
        })),
      });
    },
  );

  fastify.post<{ Body: ListBody }>(
    "/lists",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.user!;
      const body = request.body ?? {};
      const name = requiredName(body.name);
      const description = optionalDescription(body.description);

      if (!name) {
        return reply.status(400).send({ error: "O nome da coleção é obrigatório e deve ter até 120 caracteres." });
      }
      if (body.description !== undefined && description === undefined) {
        return reply.status(400).send({ error: "A descrição deve ter até 1000 caracteres." });
      }
      if (body.isPublic !== undefined && typeof body.isPublic !== "boolean") {
        return reply.status(400).send({ error: "isPublic deve ser um booleano." });
      }

      const list = await prisma.movieList.create({
        data: {
          userId: user.id,
          name,
          description: description ?? null,
          isPublic: body.isPublic === true,
        },
      });

      return reply.status(201).send({ list });
    },
  );

  fastify.get<{ Params: ListParams }>(
    "/lists/:listId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const list = await prisma.movieList.findFirst({
        where: { id: request.params.listId, userId: request.user!.id },
        include: {
          movies: {
            include: { movie: true },
            orderBy: [{ position: "asc" }, { addedAt: "desc" }],
          },
        },
      });

      if (!list) return reply.status(404).send({ error: "Coleção não encontrada." });
      return reply.send({ list });
    },
  );

  fastify.patch<{ Params: ListParams; Body: ListBody }>(
    "/lists/:listId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const body = request.body ?? {};
      const name = body.name === undefined ? undefined : requiredName(body.name);
      const description = optionalDescription(body.description);

      if (body.name !== undefined && !name) {
        return reply.status(400).send({ error: "O nome da coleção deve ter entre 1 e 120 caracteres." });
      }
      if (body.description !== undefined && description === undefined) {
        return reply.status(400).send({ error: "A descrição deve ter até 1000 caracteres." });
      }
      if (body.isPublic !== undefined && typeof body.isPublic !== "boolean") {
        return reply.status(400).send({ error: "isPublic deve ser um booleano." });
      }

      const owned = await prisma.movieList.findFirst({
        where: { id: request.params.listId, userId: request.user!.id },
        select: { id: true },
      });
      if (!owned) return reply.status(404).send({ error: "Coleção não encontrada." });

      const list = await prisma.movieList.update({
        where: { id: owned.id },
        data: {
          ...(typeof name === "string" ? { name } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(typeof body.isPublic === "boolean" ? { isPublic: body.isPublic } : {}),
        },
      });

      return reply.send({ list });
    },
  );

  fastify.delete<{ Params: ListParams }>(
    "/lists/:listId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const deleted = await prisma.movieList.deleteMany({
        where: { id: request.params.listId, userId: request.user!.id },
      });
      if (!deleted.count) return reply.status(404).send({ error: "Coleção não encontrada." });
      return reply.send({ success: true });
    },
  );

  fastify.post<{ Params: ListParams; Body: ListMovieBody }>(
    "/lists/:listId/movies",
    { preHandler: requireAuth },
    async (request, reply) => {
      const movieId = typeof request.body?.movieId === "string" ? request.body.movieId.trim() : "";
      if (!movieId) return reply.status(400).send({ error: "movieId é obrigatório." });

      const [list, movie] = await Promise.all([
        prisma.movieList.findFirst({
          where: { id: request.params.listId, userId: request.user!.id },
          select: { id: true, name: true },
        }),
        prisma.movie.findUnique({ where: { id: movieId }, select: { id: true } }),
      ]);

      if (!list) return reply.status(404).send({ error: "Coleção não encontrada." });
      if (!movie) return reply.status(404).send({ error: "Filme não encontrado." });

      const existing = await prisma.movieListMovie.findUnique({
        where: { listId_movieId: { listId: list.id, movieId } },
        include: { movie: true },
      });
      if (existing) {
        return reply.send({
          item: existing,
          alreadyAdded: true,
          message: `Filme já adicionado na ${list.name}.`,
        });
      }

      const item = await prisma.movieListMovie.create({
        data: { listId: list.id, movieId },
        include: { movie: true },
      });

      return reply.status(201).send({
        item,
        alreadyAdded: false,
        message: `Filme adicionado na ${list.name}.`,
      });
    },
  );

  fastify.delete<{ Params: ListParams; Querystring: ListQuery }>(
    "/lists/:listId/movies",
    { preHandler: requireAuth },
    async (request, reply) => {
      const movieId = request.query.movieId?.trim() || "";
      if (!movieId) return reply.status(400).send({ error: "movieId é obrigatório." });

      const list = await prisma.movieList.findFirst({
        where: { id: request.params.listId, userId: request.user!.id },
        select: { id: true },
      });
      if (!list) return reply.status(404).send({ error: "Coleção não encontrada." });

      const deleted = await prisma.movieListMovie.deleteMany({
        where: { listId: list.id, movieId },
      });
      if (!deleted.count) return reply.status(404).send({ error: "O filme não está nesta coleção." });

      return reply.send({ success: true });
    },
  );
}
