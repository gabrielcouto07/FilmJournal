import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { searchTmdbMovies } from "@/lib/tmdb";

export const dynamic = "force-dynamic";

/** Autocomplete for the guess box: local titles for "mine", TMDB for "popular". */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Faça login." }, { status: 401 });

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  const source = url.searchParams.get("source") === "popular" ? "popular" : "mine";
  if (query.length < 2) return NextResponse.json({ suggestions: [] });

  try {
    if (source === "mine") {
      const movies = await prisma.movie.findMany({
        where: {
          title: { contains: query, mode: "insensitive" },
          userMovies: { some: { userId: user.id, OR: [{ watched: true }, { rating: { not: null } }] } },
        },
        select: { title: true, year: true },
        orderBy: [{ tmdbVoteCount: "desc" }],
        take: 8,
      });
      return NextResponse.json({ suggestions: movies });
    }

    const result = await searchTmdbMovies(query);
    return NextResponse.json({
      suggestions: result.results.slice(0, 8).map((movie) => ({
        title: movie.title,
        year: movie.release_date ? Number(movie.release_date.slice(0, 4)) || null : null,
      })),
    });
  } catch {
    return NextResponse.json({ suggestions: [] }); // autocomplete is best-effort
  }
}
