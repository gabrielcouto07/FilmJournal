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
  // "daily" guesses search the global catalog, same as "popular".
  const source = url.searchParams.get("source") === "mine" ? "mine" : "popular";
  if (query.length < 2) return NextResponse.json({ suggestions: [] });

  try {
    if (source === "mine") {
      // Guesses are graded by TMDB id, so suggestions carry it (and skip the
      // handful of local movies that never resolved one).
      const movies = await prisma.movie.findMany({
        where: {
          title: { contains: query, mode: "insensitive" },
          tmdbId: { not: null },
          userMovies: { some: { userId: user.id, OR: [{ watched: true }, { rating: { not: null } }] } },
        },
        select: { tmdbId: true, title: true, year: true },
        orderBy: [{ tmdbVoteCount: "desc" }],
        take: 8,
      });
      return NextResponse.json({ suggestions: movies });
    }

    const result = await searchTmdbMovies(query);
    return NextResponse.json({
      suggestions: result.results.slice(0, 8).map((movie) => ({
        tmdbId: movie.id,
        title: movie.title,
        year: movie.release_date ? Number(movie.release_date.slice(0, 4)) || null : null,
      })),
    });
  } catch {
    return NextResponse.json({ suggestions: [] }); // autocomplete is best-effort
  }
}
