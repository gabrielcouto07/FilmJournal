import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getTmdbMovie, getTmdbMovieWithImages, TmdbError, toMovieMetadata } from "@/lib/tmdb";
import { getCurrentUser } from "@/lib/auth";
import { CATALOG_TAG, userTag } from "@/lib/data";
import { crossOriginResponse, isSameOrigin } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const watchlist = url.searchParams.get("watchlist") === "true";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 40, 1), 100);

  const viewer = await getCurrentUser();
  const ownerId = viewer?.id || "";

  let movies: unknown[] = [];

  if (watchlist) {
    const userMovies = await prisma.userMovie.findMany({
      where: {
        userId: ownerId,
        watchlist: true,
        ...(query ? { movie: { title: { contains: query } } } : {}),
      },
      include: {
        movie: {
          include: {
            logs: {
              where: { userId: ownerId },
              orderBy: [{ watchedAt: "desc" }, { loggedAt: "desc" }],
              take: 1
            }
          }
        }
      },
      orderBy: [{ watchlistAddedAt: "desc" }, { updatedAt: "desc" }],
      take: limit,
    });
    movies = userMovies.map(um => ({
      ...um.movie,
      rating: um.rating,
      watched: um.watched,
      favorite: um.favorite,
      watchlist: um.watchlist,
      watchlistAddedAt: um.watchlistAddedAt,
      favoriteRank: um.favoriteRank
    }));
  } else {
    // Per-user state is folded into the same query — no trailing enrichment pass.
    const rawMovies = await prisma.movie.findMany({
      where: query ? { title: { contains: query } } : {},
      include: {
        logs: {
          where: { userId: ownerId },
          orderBy: [{ watchedAt: "desc" }, { loggedAt: "desc" }],
          take: 1
        },
        userMovies: { where: { userId: ownerId } },
      },
      orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
      take: limit,
    });

    movies = rawMovies.map(m => {
      const um = m.userMovies[0];
      return {
        ...m,
        userMovies: undefined,
        rating: um?.rating ?? null,
        watched: um?.watched ?? false,
        favorite: um?.favorite ?? false,
        watchlist: um?.watchlist ?? false,
        watchlistAddedAt: um?.watchlistAddedAt ?? null,
        favoriteRank: um?.favoriteRank ?? null
      };
    });
  }

  return NextResponse.json({ movies });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return crossOriginResponse();
  // Any signed-in user can add movies to their own collection.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Faça login para adicionar filmes." }, { status: 401 });
  }

  let body: { tmdbId?: unknown; watchlist?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "O corpo da requisição deve ser um JSON válido." }, { status: 400 });
  }

  const tmdbId = Number(body.tmdbId);
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    return NextResponse.json({ error: "Um tmdbId válido é obrigatório." }, { status: 400 });
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
          posterPath: existing.posterPath ?? metadata.posterPath,
        },
      })
      : await prisma.movie.create({
        data: metadata,
      });

    // Create or update UserMovie record for the owner
    const userMovie = await prisma.userMovie.upsert({
      where: {
        userId_movieId: {
          userId: user.id,
          movieId: movie.id
        }
      },
      create: {
        userId: user.id,
        movieId: movie.id,
        watchlist: body.watchlist === true,
        watchlistAddedAt: body.watchlist === true ? new Date() : null,
      },
      update: typeof body.watchlist === "boolean" ? {
        watchlist: body.watchlist,
        watchlistAddedAt: body.watchlist ? new Date() : null,
      } : {}
    });

    const mergedMovie = {
      ...movie,
      rating: userMovie.rating,
      watched: userMovie.watched,
      favorite: userMovie.favorite,
      watchlist: userMovie.watchlist,
      watchlistAddedAt: userMovie.watchlistAddedAt,
      favoriteRank: userMovie.favoriteRank
    };

    revalidateTag(userTag(user.id));
    return NextResponse.json({
      movie: mergedMovie,
      created: !existing,
      message: existing ? `Os metadados de ${movie.title} estão atualizados.` : `${movie.title} foi adicionado ao seu diário.`,
    }, { status: existing ? 200 : 201 });
  } catch (error) {
    if (error instanceof TmdbError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Não foi possível salvar este filme. Tente novamente." }, { status: 500 });
  }
}

async function setFavoriteRank(userId: string, movieId: string, rank: number | null) {
  return prisma.$transaction(async (transaction) => {
    const movie = await transaction.movie.findUnique({ where: { id: movieId } });
    if (!movie) throw new TmdbError("Movie not found.", 404);

    const userMovie = await transaction.userMovie.upsert({
      where: { userId_movieId: { userId, movieId } },
      create: { userId, movieId },
      update: {}
    });

    if (rank == null) {
      return transaction.userMovie.update({
        where: { userId_movieId: { userId, movieId } },
        data: { favoriteRank: null }
      });
    }

    const occupant = await transaction.userMovie.findFirst({
      where: { userId, favoriteRank: rank }
    });

    if (userMovie.favoriteRank === rank) return userMovie;

    // Clear the moving movie's rank first so the (userId, favoriteRank) unique constraint is never violated.
    await transaction.userMovie.update({
      where: { userId_movieId: { userId, movieId } },
      data: { favoriteRank: null }
    });

    if (occupant && occupant.movieId !== movieId) {
      await transaction.userMovie.update({
        where: { userId_movieId: { userId, movieId: occupant.movieId } },
        data: { favoriteRank: userMovie.favoriteRank ?? null }
      });
    }

    return transaction.userMovie.update({
      where: { userId_movieId: { userId, movieId } },
      data: { favoriteRank: rank }
    });
  });
}

type CollectionMutation = {
  movieId?: unknown;
  action?: unknown;
  value?: unknown;
  rank?: unknown;
};

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return crossOriginResponse();
  // Any signed-in user can modify their own collection state below. Actions that
  // mutate the shared catalog (poster/backdrop art) are gated to the owner.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Faça login para modificar filmes." }, { status: 401 });
  }

  let body: CollectionMutation;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "O corpo da requisição deve ser um JSON válido." }, { status: 400 });
  }

  if (typeof body.movieId !== "string" || !body.movieId || typeof body.action !== "string") {
    return NextResponse.json({ error: "movieId e action são obrigatórios." }, { status: 400 });
  }

  const movieId = body.movieId;

  try {
    if (body.action === "watchlist") {
      if (typeof body.value !== "boolean") {
        return NextResponse.json({ error: "As atualizações da watchlist exigem um valor booleano." }, { status: 400 });
      }
      const existing = await prisma.movie.findUnique({ where: { id: movieId } });
      if (!existing) return NextResponse.json({ error: "Filme não encontrado." }, { status: 404 });
      
      const userMovie = await prisma.userMovie.upsert({
        where: { userId_movieId: { userId: user.id, movieId } },
        create: {
          userId: user.id,
          movieId,
          watchlist: body.value,
          watchlistAddedAt: body.value ? new Date() : null,
        },
        update: {
          watchlist: body.value,
          watchlistAddedAt: body.value ? new Date() : null,
        }
      });

      const mergedMovie = {
        ...existing,
        rating: userMovie.rating,
        watched: userMovie.watched,
        favorite: userMovie.favorite,
        watchlist: userMovie.watchlist,
        watchlistAddedAt: userMovie.watchlistAddedAt,
        favoriteRank: userMovie.favoriteRank
      };

      revalidateTag(userTag(user.id));
      return NextResponse.json({ movie: mergedMovie, message: body.value ? "Adicionado à sua watchlist." : "Removido da sua watchlist." });
    }

    if (body.action === "poster" || body.action === "backdrop") {
      if (user.role !== "OWNER") {
        return NextResponse.json({ error: "A arte do catálogo só pode ser alterada pelo proprietário." }, { status: 403 });
      }
      if (typeof body.value !== "string" || !body.value.startsWith("/") || body.value.length > 200) {
        return NextResponse.json({ error: "É necessário um caminho de arte válido do TMDb." }, { status: 400 });
      }
      const existing = await prisma.movie.findUnique({ where: { id: movieId } });
      if (!existing) return NextResponse.json({ error: "Filme não encontrado." }, { status: 404 });
      if (!existing.tmdbId) return NextResponse.json({ error: "Este filme não possui uma coleção de artes no TMDb." }, { status: 409 });
      const details = await getTmdbMovieWithImages(existing.tmdbId);
      const images = body.action === "poster" ? details.images?.posters ?? [] : details.images?.backdrops ?? [];
      const defaultPath = body.action === "poster" ? details.poster_path : details.backdrop_path;
      const allowed = new Set([defaultPath, ...images.map((image) => image.file_path)]);
      if (!allowed.has(body.value)) return NextResponse.json({ error: `Este ${body.action} não está disponível para este filme.` }, { status: 400 });
      
      const movie = await prisma.movie.update({
        where: { id: movieId },
        data: body.action === "poster" ? { preferredPosterPath: body.value } : { preferredBackdropPath: body.value },
      });

      const userMovie = await prisma.userMovie.findUnique({
        where: { userId_movieId: { userId: user.id, movieId } }
      });

      const mergedMovie = {
        ...movie,
        rating: userMovie?.rating ?? null,
        watched: userMovie?.watched ?? false,
        favorite: userMovie?.favorite ?? false,
        watchlist: userMovie?.watchlist ?? false,
        watchlistAddedAt: userMovie?.watchlistAddedAt ?? null,
        favoriteRank: userMovie?.favoriteRank ?? null
      };

      revalidateTag(CATALOG_TAG); // shared catalog artwork affects every user's cached pages
      return NextResponse.json({ movie: mergedMovie, message: `${body.action === "poster" ? "Pôster" : "Fundo"} atualizado em todo o seu arquivo.` });
    }

    if (body.action === "favorite") {
      if (typeof body.value !== "boolean") {
        return NextResponse.json({ error: "As atualizações de favorito exigem um valor booleano." }, { status: 400 });
      }

      const existing = await prisma.movie.findUnique({ where: { id: movieId } });
      if (!existing) return NextResponse.json({ error: "Filme não encontrado." }, { status: 404 });

      const userMovie = await prisma.userMovie.upsert({
        where: { userId_movieId: { userId: user.id, movieId } },
        create: {
          userId: user.id,
          movieId,
          favorite: body.value,
        },
        update: {
          favorite: body.value,
        }
      });

      const mergedMovie = {
        ...existing,
        rating: userMovie.rating,
        watched: userMovie.watched,
        favorite: userMovie.favorite,
        watchlist: userMovie.watchlist,
        watchlistAddedAt: userMovie.watchlistAddedAt,
        favoriteRank: userMovie.favoriteRank
      };

      revalidateTag(userTag(user.id));
      return NextResponse.json({ movie: mergedMovie, message: body.value ? "Adicionado aos filmes favoritos." : "Removido dos filmes favoritos." });
    }

    if (body.action === "top10") {
      if (typeof body.value !== "boolean") return NextResponse.json({ error: "As atualizações do Top 10 exigem um valor booleano." }, { status: 400 });
      const existing = await prisma.movie.findUnique({ where: { id: movieId } });
      if (!existing) return NextResponse.json({ error: "Filme não encontrado." }, { status: 404 });

      if (!body.value) {
        const userMovie = await setFavoriteRank(user.id, movieId, null);
        const mergedMovie = {
          ...existing,
          rating: userMovie.rating,
          watched: userMovie.watched,
          favorite: userMovie.favorite,
          watchlist: userMovie.watchlist,
          watchlistAddedAt: userMovie.watchlistAddedAt,
          favoriteRank: userMovie.favoriteRank
        };
        revalidateTag(userTag(user.id));
        return NextResponse.json({ movie: mergedMovie, message: "Removido do seu Top 10." });
      }

      const occupiedRanks = await prisma.userMovie.findMany({
        where: { userId: user.id, favoriteRank: { not: null } },
        select: { favoriteRank: true }
      });
      const nextRank = Array.from({ length: 10 }, (_, index) => index + 1).find((rank) => !occupiedRanks.some((um) => um.favoriteRank === rank));
      if (!nextRank) return NextResponse.json({ error: "Seu Top 10 está cheio. Reordene ou remova um filme primeiro." }, { status: 409 });
      
      const userMovie = await setFavoriteRank(user.id, movieId, nextRank);
      
      const mergedMovie = {
        ...existing,
        rating: userMovie.rating,
        watched: userMovie.watched,
        favorite: userMovie.favorite,
        watchlist: userMovie.watchlist,
        watchlistAddedAt: userMovie.watchlistAddedAt,
        favoriteRank: userMovie.favoriteRank
      };

      revalidateTag(userTag(user.id));
      return NextResponse.json({ movie: mergedMovie, message: `Adicionado ao seu Top 10 na posição #${nextRank}.` });
    }

    if (body.action === "favoriteRank") {
      const rank = body.rank == null ? null : Number(body.rank);
      if (rank !== null && (!Number.isInteger(rank) || rank < 1 || rank > 10)) {
        return NextResponse.json({ error: "A posição de favorito deve estar entre 1 e 10." }, { status: 400 });
      }

      const existing = await prisma.movie.findUnique({ where: { id: movieId } });
      if (!existing) return NextResponse.json({ error: "Filme não encontrado." }, { status: 404 });

      const userMovie = await setFavoriteRank(user.id, movieId, rank);

      const mergedMovie = {
        ...existing,
        rating: userMovie.rating,
        watched: userMovie.watched,
        favorite: userMovie.favorite,
        watchlist: userMovie.watchlist,
        watchlistAddedAt: userMovie.watchlistAddedAt,
        favoriteRank: userMovie.favoriteRank
      };

      revalidateTag(userTag(user.id));
      return NextResponse.json({ movie: mergedMovie, message: rank ? `Movido para #${rank}.` : "Removido do seu Top 10." });
    }

    if (body.action === "rating") {
      const rating = body.value === null ? null : Number(body.value);
      if (rating !== null && (!Number.isFinite(rating) || rating < 0.5 || rating > 5 || rating * 2 !== Math.round(rating * 2))) {
        return NextResponse.json({ error: "A nota deve ser um valor de meia estrela, de 0,5 a 5." }, { status: 400 });
      }

      const existing = await prisma.movie.findUnique({ where: { id: movieId } });
      if (!existing) return NextResponse.json({ error: "Filme não encontrado." }, { status: 404 });

      const userMovie = await prisma.userMovie.upsert({
        where: { userId_movieId: { userId: user.id, movieId } },
        create: {
          userId: user.id,
          movieId,
          rating,
        },
        update: {
          rating,
        }
      });

      const mergedMovie = {
        ...existing,
        rating: userMovie.rating,
        watched: userMovie.watched,
        favorite: userMovie.favorite,
        watchlist: userMovie.watchlist,
        watchlistAddedAt: userMovie.watchlistAddedAt,
        favoriteRank: userMovie.favoriteRank
      };

      revalidateTag(userTag(user.id));
      return NextResponse.json({ movie: mergedMovie, message: rating ? `Nota ${rating.toFixed(1)} estrelas.` : "Nota removida." });
    }

    return NextResponse.json({ error: "Ação de coleção não suportada." }, { status: 400 });
  } catch (error) {
    if (error instanceof TmdbError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Não foi possível atualizar esta coleção." }, { status: 500 });
  }
}
