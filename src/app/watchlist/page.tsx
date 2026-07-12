import Link from "next/link";
import CollectionControls from "@/components/CollectionControls";
import { getPosterUrl } from "@/lib/tmdb";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const movies = await prisma.movie.findMany({
    where: { watchlist: true },
    orderBy: [{ watchlistAddedAt: "desc" }, { updatedAt: "desc" }],
  });

  return (
    <main className="page-shell max-w-6xl">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-5"><div><p className="eyebrow">The queue</p><h1 className="mt-3 text-5xl font-black tracking-[-.055em] text-white sm:text-6xl">Watchlist.</h1><p className="mt-4 max-w-xl leading-7 text-slate-400">A considered queue for films waiting on the right night, the right screen, or the right mood.</p></div><div className="surface-subtle rounded-2xl px-5 py-4"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">Saved films</p><p className="mt-1 text-3xl font-black text-emerald-200">{movies.length}</p></div></header>
      {movies.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{movies.map((movie, index) => {
        const posterUrl = getPosterUrl(movie.posterPath);
        return <article key={movie.id} className="surface flex gap-4 rounded-2xl p-3"><div className="flex w-7 shrink-0 items-start justify-center pt-1 text-sm font-black text-emerald-300/75">{String(index + 1).padStart(2, "0")}</div><Link href={`/film/${movie.id}`} className="h-32 w-20 shrink-0 overflow-hidden rounded-xl bg-white/[0.04]">{posterUrl ? <img src={posterUrl} alt={`${movie.title} poster`} className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center p-2 text-center text-[10px] text-slate-500">No poster</span>}</Link><div className="min-w-0 flex-1 py-1"><Link href={`/film/${movie.id}`} className="block truncate text-lg font-black tracking-tight text-white hover:text-emerald-200">{movie.title}</Link><p className="mt-1 text-xs font-bold uppercase tracking-[.14em] text-slate-500">{movie.year ?? "Year unknown"}</p><p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-400">{movie.overview || "No overview available yet."}</p><div className="mt-4"><CollectionControls movieId={movie.id} initialWatchlist={movie.watchlist} initialFavoriteRank={movie.favoriteRank} compact /></div></div></article>;
      })}</div> : <div className="surface-subtle rounded-3xl p-12 text-center"><p className="text-lg font-bold text-white">The queue is open.</p><p className="mt-2 text-sm text-slate-500">Find a film and save it for later.</p><Link href="/search" className="mt-5 inline-flex text-sm font-bold text-emerald-300">Discover films →</Link></div>}
    </main>
  );
}
