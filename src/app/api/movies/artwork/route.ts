import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { enrichMovieMetadata } from "@/lib/movie-metadata";
import { prisma } from "@/lib/prisma";
import { getPosterUrl } from "@/lib/tmdb";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Faça login para carregar esta imagem." }, { status: 401 });

  let body: { movieId?: unknown; title?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "O corpo da requisição deve ser um JSON válido." }, { status: 400 });
  }
  const movieId = typeof body.movieId === "string" && body.movieId ? body.movieId : null;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!movieId && !title) {
    return NextResponse.json({ error: "movieId ou título é obrigatório." }, { status: 400 });
  }

  const owned = await prisma.movie.findFirst({
    where: {
      ...(movieId ? { id: movieId } : { title }),
      OR: [
        { userMovies: { some: { userId: user.id } } },
        { logs: { some: { userId: user.id } } },
      ],
    },
    select: { id: true },
  });
  if (!owned) return NextResponse.json({ error: "Filme não encontrado na sua coleção." }, { status: 404 });

  try {
    const movie = await enrichMovieMetadata(owned.id);
    const posterUrl = getPosterUrl(movie?.preferredPosterPath ?? movie?.posterPath);
    if (!posterUrl) return NextResponse.json({ error: "O TMDB não encontrou uma capa para este filme." }, { status: 404 });
    return NextResponse.json({ posterUrl });
  } catch (error) {
    console.error("[movies/artwork]", error);
    return NextResponse.json({ error: "Não foi possível buscar esta capa agora." }, { status: 502 });
  }
}
