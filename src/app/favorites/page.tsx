import Link from "next/link";
import FavoritesManager from "@/components/FavoritesManager";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const movies = await prisma.movie.findMany({ where: { favoriteRank: { not: null } }, orderBy: { favoriteRank: "asc" } });

  return (
    <main className="page-shell max-w-5xl">
      <header className="mb-9 flex flex-wrap items-end justify-between gap-5"><div><p className="eyebrow">Personal canon</p><h1 className="mt-3 text-5xl font-black tracking-[-.055em] text-white sm:text-6xl">Top 10.</h1><p className="mt-4 max-w-xl leading-7 text-slate-400">The films that have earned a permanent place in your own small canon. Move a title to swap positions.</p></div><p className="rounded-full border border-emerald-300/20 bg-emerald-300/[0.06] px-4 py-2 text-sm font-bold text-emerald-100">{movies.length} / 10 ranked</p></header>
      {movies.length ? <FavoritesManager initialMovies={movies} /> : <div className="surface-subtle rounded-3xl p-12 text-center"><p className="text-lg font-bold text-white">Your canon is waiting.</p><p className="mt-2 text-sm text-slate-500">Open any film and add it to the Top 10 when it earns the spot.</p><Link href="/diary" className="mt-5 inline-flex text-sm font-bold text-emerald-300">Browse diary →</Link></div>}
    </main>
  );
}
