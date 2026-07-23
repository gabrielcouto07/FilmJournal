import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { userTag } from "@/lib/data";
import { crossOriginResponse, isSameOrigin } from "@/lib/security";

export const dynamic = "force-dynamic";

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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 200);

  const viewer = await getCurrentUser();
  const ownerId = viewer?.id || "";

  // O estado do usuário já vem na mesma consulta.
  const logs = await prisma.logEntry.findMany({
    where: { userId: ownerId },
    include: { movie: { include: { userMovies: { where: { userId: ownerId } } } } },
    orderBy: [{ watchedAt: "desc" }, { loggedAt: "desc" }],
    take: limit
  });

  const enrichedLogs = logs.map(log => {
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
        favoriteRank: um?.favoriteRank ?? null
      }
    };
  });

  return NextResponse.json({ logs: enrichedLogs });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return crossOriginResponse();
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Faça login para registrar sessões." }, { status: 401 });
  }

  let body: { movieId?: unknown; watchedAt?: unknown; rating?: unknown; review?: unknown; rewatch?: unknown; tags?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "O corpo da requisição deve ser um JSON válido." }, { status: 400 }); }
  if (typeof body.movieId !== "string" || !body.movieId) return NextResponse.json({ error: "movieId é obrigatório." }, { status: 400 });
  const parsedWatchedAt = dateValue(body.watchedAt);
  if (body.watchedAt !== undefined && parsedWatchedAt === undefined) return NextResponse.json({ error: "watchedAt deve ser uma data válida no formato AAAA-MM-DD." }, { status: 400 });
  const watchedAt = parsedWatchedAt ?? new Date();
  const rating = ratingValue(body.rating);
  const review = textValue(body.review, 12000);
  const tags = textValue(body.tags, 800);
  if (body.rating !== undefined && rating === undefined) return NextResponse.json({ error: "A nota deve ser um valor de meia estrela, de 0,5 a 5." }, { status: 400 });
  if (body.review !== undefined && review === undefined) return NextResponse.json({ error: "A crítica é muito longa." }, { status: 400 });
  if (body.tags !== undefined && tags === undefined) return NextResponse.json({ error: "As tags são muito longas." }, { status: 400 });
  if (body.rewatch !== undefined && typeof body.rewatch !== "boolean") return NextResponse.json({ error: "rewatch deve ser um booleano." }, { status: 400 });

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const movie = await transaction.movie.findUnique({ where: { id: body.movieId as string } });
      if (!movie) return null;

      const userMovie = await transaction.userMovie.findUnique({
        where: { userId_movieId: { userId: user.id, movieId: movie.id } }
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
        }
      });

      const enrichedMovie = {
        ...movie,
        rating: updatedUserMovie.rating,
        watched: updatedUserMovie.watched,
        favorite: updatedUserMovie.favorite,
        watchlist: updatedUserMovie.watchlist,
        watchlistAddedAt: updatedUserMovie.watchlistAddedAt,
        favoriteRank: updatedUserMovie.favoriteRank
      };

      return { log, movie: enrichedMovie };
    });

    if (!result) return NextResponse.json({ error: "Filme não encontrado." }, { status: 404 });
    revalidateTag(userTag(user.id));
    return NextResponse.json({ ...result, message: `${result.movie.title} foi registrado.` }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Não foi possível registrar esta sessão." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return crossOriginResponse();
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Faça login para editar entradas do diário." }, { status: 401 });
  }

  let body: { id?: unknown; rating?: unknown; review?: unknown; watchedAt?: unknown; rewatch?: unknown; tags?: unknown; favorite?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "O corpo da requisição deve ser um JSON válido." }, { status: 400 }); }
  if (typeof body.id !== "string" || !body.id) return NextResponse.json({ error: "id é obrigatório." }, { status: 400 });
  const rating = ratingValue(body.rating);
  const watchedAt = dateValue(body.watchedAt);
  const review = textValue(body.review, 12000);
  const tags = textValue(body.tags, 800);
  if (body.rating !== undefined && rating === undefined) return NextResponse.json({ error: "Nota inválida." }, { status: 400 });
  if (body.watchedAt !== undefined && watchedAt === undefined) return NextResponse.json({ error: "Data de exibição inválida." }, { status: 400 });
  if (body.review !== undefined && review === undefined) return NextResponse.json({ error: "Crítica inválida." }, { status: 400 });
  if (body.tags !== undefined && tags === undefined) return NextResponse.json({ error: "Tags inválidas." }, { status: 400 });
  if (body.rewatch !== undefined && typeof body.rewatch !== "boolean") return NextResponse.json({ error: "rewatch deve ser um booleano." }, { status: 400 });

  try {
    const existing = await prisma.logEntry.findUnique({ where: { id: body.id } });
    if (!existing) return NextResponse.json({ error: "Entrada do diário não encontrada." }, { status: 404 });
    if (existing.userId !== user.id) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

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
    return NextResponse.json({ log, message: "Entrada do diário atualizada." });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return NextResponse.json({ error: "Entrada do diário não encontrada." }, { status: 404 });
    return NextResponse.json({ error: "Não foi possível atualizar esta entrada do diário." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return crossOriginResponse();
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Faça login para excluir entradas do diário." }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id é obrigatório." }, { status: 400 });
  
  try {
    const existing = await prisma.logEntry.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Entrada do diário não encontrada." }, { status: 404 });
    if (existing.userId !== user.id) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    await prisma.logEntry.delete({ where: { id } });
    revalidateTag(userTag(user.id));
    return NextResponse.json({ message: "Entrada do diário excluída." });
  } catch {
    return NextResponse.json({ error: "Entrada do diário não encontrada." }, { status: 404 });
  }
}
