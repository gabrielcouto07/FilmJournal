import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

type Context = {
  params: Promise<{ listId: string }>;
};

export async function GET(
  _request: Request,
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
    include: {
      movies: {
        include: {
          movie: true,
        },
        orderBy: {
          addedAt: "desc",
        },
      },
    },
  });

  if (!list) {
    return NextResponse.json(
      { error: "Lista não encontrada." },
      { status: 404 },
    );
  }

  return NextResponse.json({ list });
}