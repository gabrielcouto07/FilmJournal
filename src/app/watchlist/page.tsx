import WatchlistExplorer, { type WatchlistMovie } from "@/components/WatchlistExplorer";
import { prisma } from "@/lib/prisma";
import { getOwnerUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const owner = await getOwnerUser();
  const ownerId = owner?.id || "";

  const userMovies = await prisma.userMovie.findMany({
    where: { userId: ownerId, watchlist: true },
    include: { movie: true },
    orderBy: [
      { watchlistAddedAt: "desc" },
      { updatedAt: "desc" }
    ]
  });

  const movies = userMovies.map((um) => ({
    ...um.movie,
    rating: um.rating,
    watched: um.watched,
    favorite: um.favorite,
    watchlist: um.watchlist,
    watchlistAddedAt: um.watchlistAddedAt,
    favoriteRank: um.favoriteRank
  }));

  const serialized: WatchlistMovie[] = movies.map((movie) => ({ ...movie, releaseDate: movie.releaseDate?.toISOString() ?? null, watchlistAddedAt: movie.watchlistAddedAt?.toISOString() ?? null }));
  const runtime = movies.reduce((total, movie) => total + (movie.runtime ?? 0), 0);
  return <main className="page-shell"><header className="mb-8 grid gap-6 lg:grid-cols-[1fr_auto]"><div><p className="eyebrow">A fila para a próxima noite</p><h1 className="display-title mt-3 text-5xl sm:text-7xl">Lista de Espera.</h1><p className="mt-4 max-w-2xl leading-7 text-slate-400">Ordene as possibilidades, remova-as instantaneamente ou transforme qualquer filme salvo em uma entrada real no diário.</p></div><div className="surface-subtle self-end rounded-2xl px-5 py-4 text-right"><p className="eyebrow !text-slate-600">Tamanho da fila</p><p className="mt-1 text-4xl font-black text-amber-200">{movies.length}</p><p className="text-xs text-slate-500">{runtime ? `${Math.round(runtime/60)} horas de cinema` : "Duração pendente"}</p></div></header><WatchlistExplorer initialMovies={serialized} /></main>;
}
