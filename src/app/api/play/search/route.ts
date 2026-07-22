import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { searchTmdbMovies } from "@/lib/tmdb";

export const dynamic = "force-dynamic";

type Suggestion = { tmdbId: number; title: string; year: number | null };

/**
 * Autocomplete do jogo. Sugere filmes conforme o usuário digita (prefixo/trecho).
 * O TMDb casa títulos em qualquer idioma, então funciona digitando em inglês ou
 * em português; os resultados voltam com o título em pt-BR. Em "mine" prioriza a
 * biblioteca do usuário e completa com o TMDb para nunca ficar sem sugestões.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Faça login." }, { status: 401 });

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  const source = url.searchParams.get("source") === "mine" ? "mine" : "popular";
  if (query.length < 2) return NextResponse.json({ suggestions: [] });

  const fromTmdb = async (): Promise<Suggestion[]> => {
    try {
      const result = await searchTmdbMovies(query, undefined, 1, false, "pt-BR");
      return result.results.map((movie) => ({
        tmdbId: movie.id,
        title: movie.title || movie.original_title || "",
        year: movie.release_date ? Number(movie.release_date.slice(0, 4)) || null : null,
      }));
    } catch {
      return []; // autocomplete é best-effort (ex.: TMDb indisponível)
    }
  };

  try {
    const suggestions: Suggestion[] = [];
    const seen = new Set<number>();
    const push = (list: Suggestion[]) => {
      for (const item of list) {
        if (item.tmdbId && item.title && !seen.has(item.tmdbId)) {
          seen.add(item.tmdbId);
          suggestions.push(item);
        }
      }
    };

    if (source === "mine") {
      // Só sugere filmes com ID do TMDb, usado para avaliar o palpite.
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
      push(movies.map((movie) => ({ tmdbId: movie.tmdbId as number, title: movie.title, year: movie.year })));
      // Completa com o catálogo global para não ficar vazio (ex.: biblioteca nova).
      if (suggestions.length < 8) push(await fromTmdb());
    } else {
      push(await fromTmdb());
    }

    return NextResponse.json({ suggestions: suggestions.slice(0, 8) });
  } catch {
    return NextResponse.json({ suggestions: [] }); // autocomplete is best-effort
  }
}
