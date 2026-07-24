import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const movieId = new URL(request.url).searchParams.get("movieId")?.trim() || null;
  const [lists, memberships] = await Promise.all([
    prisma.movieList.findMany({
      where: { userId: user.id },
      include: {
        _count: {
          select: { movies: true },
        },
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
  return NextResponse.json({
    lists: lists.map((list) => ({
      ...list,
      containsMovie: movieId ? containingLists.has(list.id) : false,
    })),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!name) {
    return NextResponse.json(
      { error: "O nome da lista é obrigatório." },
      { status: 400 },
    );
  }

  const list = await prisma.movieList.create({
    data: {
      userId: user.id,
      name,
      description:
        typeof body.description === "string"
          ? body.description.trim() || null
          : null,
    },
  });

  return NextResponse.json({ list }, { status: 201 });
}
