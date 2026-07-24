import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import multipart, { type MultipartFile } from "@fastify/multipart";
import { unzipSync } from "fflate";
import { prisma } from "../../lib/prisma.js";
import { CATALOG_TAG, userTag } from "../../lib/dashboard-data.js";
import { revalidateTag } from "../../lib/cache.js";
import { requireAuth } from "../../plugins/jwt.js";
import { importLetterboxdForUser } from "../../lib/letterboxd-persist.js";
import {
  LetterboxdImportValidationError,
  type LetterboxdFile,
  type LetterboxdFiles,
} from "../../lib/letterboxd-import.js";

function ratingValue(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  const rating = Number(value);
  return Number.isFinite(rating) && rating >= 0.5 && rating <= 5 && rating * 2 === Math.round(rating * 2) ? rating : undefined;
}

function dateValue(value: unknown): Date | null | undefined {
  if (value === null || value === "") return null;
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function textValue(value: unknown, maximum: number): string | null | undefined {
  if (value === null || value === "") return null;
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > maximum) return undefined;
  return value.trim() || null;
}

type LogBody = { movieId?: unknown; watchedAt?: unknown; rating?: unknown; review?: unknown; rewatch?: unknown; tags?: unknown };
type LogPatchBody = { id?: unknown; rating?: unknown; review?: unknown; watchedAt?: unknown; rewatch?: unknown; tags?: unknown; favorite?: unknown };

// Nomes usados pelo Letterboxd no ZIP de exportação. Aceitamos qualquer subconjunto.
const KNOWN_FILES: LetterboxdFile[] = [
  "diary.csv",
  "reviews.csv",
  "ratings.csv",
  "watched.csv",
  "watchlist.csv",
  "profile.csv",
  "likes/films.csv",
];

// Deixa uma margem abaixo do limite anterior da Vercel para retornar um erro mais claro.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 25 * 1024 * 1024;

function knownFileFromPath(path: string): LetterboxdFile | null {
  const normalized = path.replaceAll("\\", "/").toLowerCase();
  return KNOWN_FILES.find((known) => normalized === known || normalized.endsWith(`/${known}`)) ?? null;
}

/** Extrai do ZIP apenas os CSVs conhecidos, mesmo que estejam dentro de uma pasta. */
function filesFromZip(bytes: Uint8Array): LetterboxdFiles {
  let expandedBytes = 0;
  let limitExceeded = false;
  const entries = unzipSync(bytes, {
    filter(file) {
      if (!knownFileFromPath(file.name)) return false;
      expandedBytes += file.originalSize;
      if (file.originalSize > MAX_UNCOMPRESSED_BYTES || expandedBytes > MAX_UNCOMPRESSED_BYTES) {
        limitExceeded = true;
        return false;
      }
      return true;
    },
  });
  if (limitExceeded) {
    throw new LetterboxdImportValidationError("O conteúdo descompactado excede o limite de 25 MB.");
  }

  const decoder = new TextDecoder("utf-8");
  const files: LetterboxdFiles = {};
  let actualBytes = 0;
  for (const [path, contents] of Object.entries(entries)) {
    const known = knownFileFromPath(path);
    if (!known || files[known]) continue;
    actualBytes += contents.byteLength;
    if (actualBytes > MAX_UNCOMPRESSED_BYTES) {
      throw new LetterboxdImportValidationError("O conteúdo descompactado excede o limite de 25 MB.");
    }
    files[known] = decoder.decode(contents);
  }
  return files;
}

// Mapeia tanto o nome completo do CSV quanto o nome sem extensão/pasta para o campo do form.
const csvFieldAliases = new Map<string, LetterboxdFile>();
for (const known of KNOWN_FILES) {
  const bare = known.replace(/\.csv$/, "").replace("likes/", "");
  csvFieldAliases.set(known, known);
  csvFieldAliases.set(bare, known);
}

export default async function logsRoutes(fastify: FastifyInstance) {
  await fastify.register(multipart, { limits: { fileSize: MAX_UPLOAD_BYTES + 128 * 1024 } });

  fastify.get<{ Querystring: { limit?: string } }>("/logs", async (request, reply) => {
    const limit = Math.min(Math.max(Number(request.query.limit) || 50, 1), 200);

    const ownerId = request.user?.id || "";

    // O estado do usuário já vem na mesma consulta.
    const logs = await prisma.logEntry.findMany({
      where: { userId: ownerId },
      include: { movie: { include: { userMovies: { where: { userId: ownerId } } } } },
      orderBy: [{ watchedAt: "desc" }, { loggedAt: "desc" }],
      take: limit,
    });

    const enrichedLogs = logs.map((log) => {
      const um = log.movie.userMovies[0];
      return {
        ...log,
        movie: {
          ...log.movie,
          userMovies: undefined,
          rating: um?.rating ?? null,
          watched: um?.watched ?? false,
          favorite: um?.favorite ?? false,
          watchlist: um?.watchlist ?? false,
          watchlistAddedAt: um?.watchlistAddedAt ?? null,
          favoriteRank: um?.favoriteRank ?? null,
        },
      };
    });

    return reply.send({ logs: enrichedLogs });
  });

  fastify.post<{ Body: LogBody }>("/logs", { preHandler: requireAuth }, async (request, reply) => {
    const user = request.user!;
    const body = request.body ?? {};

    if (typeof body.movieId !== "string" || !body.movieId) return reply.status(400).send({ error: "movieId é obrigatório." });
    const parsedWatchedAt = dateValue(body.watchedAt);
    if (body.watchedAt !== undefined && parsedWatchedAt === undefined) return reply.status(400).send({ error: "watchedAt deve ser uma data válida no formato AAAA-MM-DD." });
    const watchedAt = parsedWatchedAt ?? new Date();
    const rating = ratingValue(body.rating);
    const review = textValue(body.review, 12000);
    const tags = textValue(body.tags, 800);
    if (body.rating !== undefined && rating === undefined) return reply.status(400).send({ error: "A nota deve ser um valor de meia estrela, de 0,5 a 5." });
    if (body.review !== undefined && review === undefined) return reply.status(400).send({ error: "A crítica é muito longa." });
    if (body.tags !== undefined && tags === undefined) return reply.status(400).send({ error: "As tags são muito longas." });
    if (body.rewatch !== undefined && typeof body.rewatch !== "boolean") return reply.status(400).send({ error: "rewatch deve ser um booleano." });

    try {
      const result = await prisma.$transaction(async (transaction) => {
        const movie = await transaction.movie.findUnique({ where: { id: body.movieId as string } });
        if (!movie) return null;

        const userMovie = await transaction.userMovie.findUnique({
          where: { userId_movieId: { userId: user.id, movieId: movie.id } },
        });

        const log = await transaction.logEntry.create({
          data: {
            userId: user.id,
            movieId: movie.id,
            sourceKey: `manual:${movie.id}:${randomUUID()}`,
            sourceType: "manual",
            loggedAt: new Date(),
            watchedAt,
            rating: rating ?? userMovie?.rating ?? null,
            review: review ?? null,
            rewatch: body.rewatch === true || (userMovie?.watched ?? false),
            tags: tags ?? null,
          },
        });

        // Atualiza o estado do filme para o usuário.
        const updatedUserMovie = await transaction.userMovie.upsert({
          where: { userId_movieId: { userId: user.id, movieId: movie.id } },
          create: {
            userId: user.id,
            movieId: movie.id,
            watched: true,
            rating: rating ?? userMovie?.rating ?? null,
            watchlist: false,
            watchlistAddedAt: null,
          },
          update: {
            watched: true,
            rating: rating ?? userMovie?.rating ?? null,
            watchlist: false,
            watchlistAddedAt: null,
          },
        });

        const enrichedMovie = {
          ...movie,
          rating: updatedUserMovie.rating,
          watched: updatedUserMovie.watched,
          favorite: updatedUserMovie.favorite,
          watchlist: updatedUserMovie.watchlist,
          watchlistAddedAt: updatedUserMovie.watchlistAddedAt,
          favoriteRank: updatedUserMovie.favoriteRank,
        };

        return { log, movie: enrichedMovie };
      });

      if (!result) return reply.status(404).send({ error: "Filme não encontrado." });
      revalidateTag(userTag(user.id));
      return reply.status(201).send({ ...result, message: `${result.movie.title} foi registrado.` });
    } catch (error) {
      request.log.error(error, "[logs] create failed");
      return reply.status(500).send({ error: "Não foi possível registrar esta sessão." });
    }
  });

  fastify.patch<{ Body: LogPatchBody }>("/logs", { preHandler: requireAuth }, async (request, reply) => {
    const user = request.user!;
    const body = request.body ?? {};

    if (typeof body.id !== "string" || !body.id) return reply.status(400).send({ error: "id é obrigatório." });
    const rating = ratingValue(body.rating);
    const watchedAt = dateValue(body.watchedAt);
    const review = textValue(body.review, 12000);
    const tags = textValue(body.tags, 800);
    if (body.rating !== undefined && rating === undefined) return reply.status(400).send({ error: "Nota inválida." });
    if (body.watchedAt !== undefined && watchedAt === undefined) return reply.status(400).send({ error: "Data de exibição inválida." });
    if (body.review !== undefined && review === undefined) return reply.status(400).send({ error: "Crítica inválida." });
    if (body.tags !== undefined && tags === undefined) return reply.status(400).send({ error: "Tags inválidas." });
    if (body.rewatch !== undefined && typeof body.rewatch !== "boolean") return reply.status(400).send({ error: "rewatch deve ser um booleano." });

    try {
      const existing = await prisma.logEntry.findUnique({ where: { id: body.id } });
      if (!existing) return reply.status(404).send({ error: "Entrada do diário não encontrada." });
      if (existing.userId !== user.id) return reply.status(401).send({ error: "Não autorizado." });

      const log = await prisma.logEntry.update({
        where: { id: body.id },
        data: {
          ...(body.rating !== undefined ? { rating } : {}),
          ...(body.review !== undefined ? { review } : {}),
          ...(body.watchedAt !== undefined ? { watchedAt } : {}),
          ...(body.rewatch !== undefined ? { rewatch: body.rewatch } : {}),
          ...(body.tags !== undefined ? { tags } : {}),
        },
      });

      // Atualiza o estado do filme para o usuário.
      const updateData: { favorite?: boolean; rating?: number | null } = {};
      if (typeof body.favorite === "boolean") updateData.favorite = body.favorite;
      if (body.rating !== undefined) updateData.rating = rating;

      if (Object.keys(updateData).length > 0) {
        await prisma.userMovie.upsert({
          where: { userId_movieId: { userId: user.id, movieId: existing.movieId } },
          create: {
            userId: user.id,
            movieId: existing.movieId,
            ...updateData,
          },
          update: updateData,
        });
      }

      revalidateTag(userTag(user.id));
      return reply.send({ log, message: "Entrada do diário atualizada." });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return reply.status(404).send({ error: "Entrada do diário não encontrada." });
      request.log.error(error, "[logs] update failed");
      return reply.status(500).send({ error: "Não foi possível atualizar esta entrada do diário." });
    }
  });

  fastify.delete<{ Querystring: { id?: string } }>("/logs", { preHandler: requireAuth }, async (request, reply) => {
    const user = request.user!;

    const id = request.query.id;
    if (!id) return reply.status(400).send({ error: "id é obrigatório." });

    try {
      const existing = await prisma.logEntry.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send({ error: "Entrada do diário não encontrada." });
      if (existing.userId !== user.id) return reply.status(401).send({ error: "Não autorizado." });

      await prisma.logEntry.delete({ where: { id } });
      revalidateTag(userTag(user.id));
      return reply.send({ message: "Entrada do diário excluída." });
    } catch (error) {
      request.log.error(error, "[logs] delete failed");
      return reply.status(404).send({ error: "Entrada do diário não encontrada." });
    }
  });

  /** Importa um ZIP do Letterboxd ou seus CSVs separados para o diário do usuário. */
  fastify.post("/import/letterboxd", { preHandler: requireAuth }, async (request, reply) => {
    const user = request.user!;

    const contentType = request.headers["content-type"] ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return reply.status(400).send({ error: "Envie um arquivo .zip do Letterboxd (ou os CSVs) como multipart/form-data." });
    }

    const contentLength = Number(request.headers["content-length"]);
    if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_BYTES + 128 * 1024) {
      return reply.status(413).send({ error: "O envio excede o limite de 4 MB da importação web." });
    }

    // Junta as partes de arquivo do multipart antes de decidir entre ZIP e CSVs
    // separados — igual ao formData() do Next, que só expõe o form já completo.
    const archiveByField = new Map<string, { filename: string; buffer: Buffer }>();
    const csvBuffers = new Map<LetterboxdFile, Buffer>();

    try {
      for await (const part of request.parts()) {
        if (part.type !== "file") continue;
        const filePart = part as MultipartFile;
        const buffer = await filePart.toBuffer();
        if (buffer.length === 0) continue;

        if (filePart.fieldname === "archive" || filePart.fieldname === "zip" || filePart.fieldname === "file") {
          if (!archiveByField.has(filePart.fieldname)) {
            archiveByField.set(filePart.fieldname, { filename: filePart.filename ?? "", buffer });
          }
          continue;
        }

        const known = csvFieldAliases.get(filePart.fieldname);
        if (known && !csvBuffers.has(known)) {
          csvBuffers.set(known, buffer);
        }
      }
    } catch {
      return reply.status(400).send({ error: "Não foi possível ler o formulário enviado." });
    }

    const archiveEntry = archiveByField.get("archive") ?? archiveByField.get("zip") ?? archiveByField.get("file") ?? null;

    let files: LetterboxdFiles = {};
    const errors: string[] = [];

    if (archiveEntry) {
      if (!archiveEntry.filename.toLowerCase().endsWith(".zip")) {
        return reply.status(400).send({ error: "O arquivo principal precisa ser um .zip exportado pelo Letterboxd." });
      }
      if (archiveEntry.buffer.length > MAX_UPLOAD_BYTES) {
        return reply.status(413).send({ error: "O arquivo excede o limite de 4 MB da importação web." });
      }
      try {
        files = filesFromZip(new Uint8Array(archiveEntry.buffer));
      } catch (error) {
        if (error instanceof LetterboxdImportValidationError) {
          return reply.status(413).send({ error: error.message });
        }
        return reply.status(400).send({ error: "Não foi possível ler o .zip. Verifique se é o export do Letterboxd." });
      }
    } else {
      // Aceita o nome completo do CSV ou o nome sem extensão.
      let totalBytes = 0;
      for (const known of KNOWN_FILES) {
        const buffer = csvBuffers.get(known);
        if (!buffer) continue;
        totalBytes += buffer.length;
        if (totalBytes > MAX_UPLOAD_BYTES) {
          return reply.status(413).send({ error: "Os arquivos excedem o limite de 4 MB da importação web." });
        }
        try {
          files[known] = buffer.toString("utf-8");
        } catch {
          errors.push(`Falha ao ler ${known}.`);
        }
      }
    }

    if (Object.keys(files).length === 0) {
      return reply.status(400).send({ error: "Nenhum arquivo reconhecido do Letterboxd foi encontrado.", errors });
    }

    try {
      const summary = await importLetterboxdForUser(user.id, files);
      // Limpa o cache para mostrar o conteúdo importado na hora.
      revalidateTag(userTag(user.id));
      revalidateTag(CATALOG_TAG);
      return reply.send({ ok: true, summary, errors });
    } catch (error) {
      if (error instanceof LetterboxdImportValidationError) {
        return reply.status(422).send({ error: error.message, errors });
      }
      request.log.error(error, "[import/letterboxd]");
      return reply.status(500).send({ error: "Não foi possível concluir a importação. Tente novamente." });
    }
  });
}
