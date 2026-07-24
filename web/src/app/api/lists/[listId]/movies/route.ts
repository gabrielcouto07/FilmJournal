import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

type Context = {
  params: Promise<{ listId: string }>;
};

export async function POST(
  request: Request,
  { params }: Context,
) {
  const user = await getCurrentUser();
  const { listId } = await params;

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const list = await prisma.movieList.findFirst({
    where: {
      id: listId,
      userId: user.id,
    },
  });

  if (!list) {
    return NextResponse.json({ error: "Lista não encontrada." }, { status: 404 });
  }

  const body = await request.json();

  if (typeof body.movieId !== "string" || !body.movieId) {
    return NextResponse.json({ error: "movieId é obrigatório." }, { status: 400 });
  }

  const movie = await prisma.movie.findUnique({
    where: { id: body.movieId },
  });

  if (!movie) {
    return NextResponse.json({ error: "Filme não encontrado." }, { status: 404 });
  }

  const existingItem = await prisma.movieListMovie.findUnique({
    where: {
      listId_movieId: {
        listId,
        movieId: body.movieId,
      },
    },
    include: {
      movie: true,
    },
  });

  if (existingItem) {
    return NextResponse.json({
      item: existingItem,
      alreadyAdded: true,
      message: `Filme já adicionado na ${list.name}.`,
    });
  }

  const item = await prisma.movieListMovie.create({
    data: {
      listId,
      movieId: body.movieId,
    },
    include: {
      movie: true,
    },
  });

  return NextResponse.json({
    item,
    alreadyAdded: false,
    message: `Filme adicionado na ${list.name}.`,
  }, { status: 201 });
}

export async function DELETE(
  request: Request,
  { params }: Context,
) {
  const user = await getCurrentUser();
  const { listId } = await params;

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const list = await prisma.movieList.findFirst({
    where: {
      id: listId,
      userId: user.id,
    },
  });

  if (!list) {
    return NextResponse.json({ error: "Lista não encontrada." }, { status: 404 });
  }

  const movieId = new URL(request.url).searchParams.get("movieId");

  if (!movieId) {
    return NextResponse.json({ error: "movieId é obrigatório." }, { status: 400 });
  }

  await prisma.movieListMovie.delete({
    where: {
      listId_movieId: {
        listId,
        movieId,
      },
    },
  });

  return NextResponse.json({ success: true });
}
