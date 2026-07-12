import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTmdbMovie, TmdbError, toMovieMetadata } from "@/lib/tmdb";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const watchlist = url.searchParams.get("watchlist") === "true";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 40, 1), 100);

  const movies = await prisma.movie.findMany({
    where: {
      ...(query ? { title: { contains: query } } : {}),
      ...(watchlist ? { watchlist: true } : {}),
    },
    include: { logs: { orderBy: [{ watchedAt: "desc" }, { loggedAt: "desc" }], take: 1 } },
    orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
    take: limit,
  });

  return NextResponse.json({ movies });
}

export async function POST(request: Request) {
  let body: { tmdbId?: unknown; watchlist?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const tmdbId = Number(body.tmdbId);
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    return NextResponse.json({ error: "A valid tmdbId is required." }, { status: 400 });
  }

  try {
    const details = await getTmdbMovie(tmdbId);
    const metadata = toMovieMetadata(details);
    const existing = await prisma.movie.findUnique({ where: { tmdbId } });
    const movie = existing
      ? await prisma.movie.update({
        where: { id: existing.id },
        data: {
          ...metadata,
          ...(typeof body.watchlist === "boolean" ? {
            watchlist: body.watchlist,
            watchlistAddedAt: body.watchlist ? existing.watchlistAddedAt ?? new Date() : null,
          } : {}),
        },
      })
      : await prisma.movie.create({
        data: {
          ...metadata,
          watchlist: body.watchlist === true,
          watchlistAddedAt: body.watchlist === true ? new Date() : null,
        },
      });

    return NextResponse.json({
      movie,
      created: !existing,
      message: existing ? `${movie.title} metadata is up to date.` : `${movie.title} was added to your journal.`,
    }, { status: existing ? 200 : 201 });
  } catch (error) {
    if (error instanceof TmdbError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Could not save this movie. Please try again." }, { status: 500 });
  }
}

type CollectionMutation = {
  movieId?: unknown;
  action?: unknown;
  value?: unknown;
  rank?: unknown;
};

async function setFavoriteRank(movieId: string, rank: number | null) {
  return prisma.$transaction(async (transaction) => {
    const movie = await transaction.movie.findUnique({ where: { id: movieId } });
    if (!movie) throw new TmdbError("Movie not found.", 404);

    if (rank == null) {
      return transaction.movie.update({ where: { id: movie.id }, data: { favoriteRank: null } });
    }

    const occupant = await transaction.movie.findUnique({ where: { favoriteRank: rank } });
    if (movie.favoriteRank === rank) return movie;

    // Clear the moving movie first so SQLite's unique rank constraint is never violated.
    await transaction.movie.update({ where: { id: movie.id }, data: { favoriteRank: null } });
    if (occupant && occupant.id !== movie.id) {
      await transaction.movie.update({
        where: { id: occupant.id },
        data: { favoriteRank: movie.favoriteRank ?? null },
      });
    }

    return transaction.movie.update({ where: { id: movie.id }, data: { favoriteRank: rank } });
  });
}

export async function PATCH(request: Request) {
  let body: CollectionMutation;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (typeof body.movieId !== "string" || !body.movieId || typeof body.action !== "string") {
    return NextResponse.json({ error: "movieId and action are required." }, { status: 400 });
  }

  try {
    if (body.action === "watchlist") {
      if (typeof body.value !== "boolean") {
        return NextResponse.json({ error: "Watchlist updates require a boolean value." }, { status: 400 });
      }
      const existing = await prisma.movie.findUnique({ where: { id: body.movieId } });
      if (!existing) return NextResponse.json({ error: "Movie not found." }, { status: 404 });
      const movie = await prisma.movie.update({
        where: { id: body.movieId },
        data: {
          watchlist: body.value,
          watchlistAddedAt: body.value ? existing.watchlistAddedAt ?? new Date() : null,
        },
      });
      return NextResponse.json({ movie, message: body.value ? "Added to your watchlist." : "Removed from your watchlist." });
    }

    if (body.action === "favorite") {
      if (typeof body.value !== "boolean") {
        return NextResponse.json({ error: "Favorite updates require a boolean value." }, { status: 400 });
      }
      if (!body.value) {
        const movie = await setFavoriteRank(body.movieId, null);
        return NextResponse.json({ movie, message: "Removed from your Top 10." });
      }

      const occupiedRanks = await prisma.movie.findMany({ where: { favoriteRank: { not: null } }, select: { favoriteRank: true } });
      const nextRank = Array.from({ length: 10 }, (_, index) => index + 1).find((rank) => !occupiedRanks.some((movie) => movie.favoriteRank === rank));
      if (!nextRank) return NextResponse.json({ error: "Your Top 10 is full. Reorder or remove a favorite first." }, { status: 409 });
      const movie = await setFavoriteRank(body.movieId, nextRank);
      return NextResponse.json({ movie, message: `Added to your Top 10 at #${nextRank}.` });
    }

    if (body.action === "favoriteRank") {
      const rank = body.rank == null ? null : Number(body.rank);
      if (rank !== null && (!Number.isInteger(rank) || rank < 1 || rank > 10)) {
        return NextResponse.json({ error: "Favorite rank must be between 1 and 10." }, { status: 400 });
      }
      const movie = await setFavoriteRank(body.movieId, rank);
      return NextResponse.json({ movie, message: rank ? `Moved to #${rank}.` : "Removed from your Top 10." });
    }

    return NextResponse.json({ error: "Unsupported collection action." }, { status: 400 });
  } catch (error) {
    if (error instanceof TmdbError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Could not update this collection." }, { status: 500 });
  }
}
