import FavoritesManager from "@/components/FavoritesManager";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const viewer = await getCurrentUser();
  const ownerId = viewer?.id || "";

  const userMovies = await prisma.userMovie.findMany({
    where: {
      userId: ownerId,
      OR: [{ favorite: true }, { favoriteRank: { not: null } }]
    },
    include: { movie: true },
    orderBy: [
      { favoriteRank: "asc" }
    ]
  });

  // Sort manually: ranked favorites first (ascending), then unranked favorites by title.
  const movies = userMovies.map((um) => ({
    ...um.movie,
    rating: um.rating,
    watched: um.watched,
    favorite: um.favorite,
    watchlist: um.watchlist,
    watchlistAddedAt: um.watchlistAddedAt,
    favoriteRank: um.favoriteRank
  }));

  // Sort remainder movies with same rank (or null rank) by title
  movies.sort((a, b) => {
    if (a.favoriteRank !== null && b.favoriteRank !== null) {
      return a.favoriteRank - b.favoriteRank;
    }
    if (a.favoriteRank !== null) return -1;
    if (b.favoriteRank !== null) return 1;
    return a.title.localeCompare(b.title);
  });

  const ranked = movies.filter((movie) => movie.favoriteRank != null).length;
  return <main className="page-shell max-w-6xl"><header className="mb-9 flex flex-wrap items-end justify-between gap-6"><div><p className="eyebrow">Cânone pessoal</p><h1 className="display-title mt-3 text-5xl sm:text-7xl">O Top 10.</h1><p className="mt-4 max-w-2xl leading-7 text-slate-400">Um ranking permanente para os filmes essenciais, com uma coleção de favoritos mais ampla ao redor dele. Mova os títulos com os controles acessíveis.</p></div><div className="rounded-full border border-amber-300/20 bg-amber-300/[0.06] px-5 py-2.5 text-sm font-black text-amber-100">{ranked} / 10 classificados</div></header><FavoritesManager initialMovies={movies} /></main>;
}
