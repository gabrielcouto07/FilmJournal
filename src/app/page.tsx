import Link from "next/link";
import MovieCard from "@/components/MovieCard";
import { getPosterUrl } from "@/lib/tmdb";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getDashboardData() {
  try {
    const [rawLogs, movieCount, logCount, favoriteCount, watchlistCount, favoriteMovies, watchlistMovies] = await Promise.all([
      prisma.logEntry.findMany({ include: { movie: true }, orderBy: [{ watchedAt: "desc" }, { loggedAt: "desc" }], take: 16 }),
      prisma.movie.count(),
      prisma.logEntry.count(),
      prisma.movie.count({ where: { favoriteRank: { not: null } } }),
      prisma.movie.count({ where: { watchlist: true } }),
      prisma.movie.findMany({ where: { favoriteRank: { not: null } }, orderBy: { favoriteRank: "asc" }, take: 5 }),
      prisma.movie.findMany({ where: { watchlist: true }, orderBy: [{ watchlistAddedAt: "desc" }, { updatedAt: "desc" }], take: 4 }),
    ]);
    const recentLogs = rawLogs.filter((log, index, entries) => entries.findIndex((entry) => (entry.dedupeKey ?? entry.id) === (log.dedupeKey ?? log.id)) === index).slice(0, 8);
    return { recentLogs, movieCount, logCount, favoriteCount, watchlistCount, favoriteMovies, watchlistMovies };
  } catch {
    return { recentLogs: [], movieCount: 0, logCount: 0, favoriteCount: 0, watchlistCount: 0, favoriteMovies: [], watchlistMovies: [] };
  }
}

export default async function HomePage() {
  const { recentLogs, movieCount, logCount, favoriteCount, watchlistCount, favoriteMovies, watchlistMovies } = await getDashboardData();
  const featured = recentLogs[0];
  const backdrop = getPosterUrl(featured?.movie.backdropPath);

  return (
    <main className="page-shell">
      <section className="surface relative isolate overflow-hidden rounded-[2rem] px-6 py-10 sm:px-10 sm:py-14">
        {backdrop && <div className="absolute inset-0 -z-20 bg-cover bg-center opacity-30" style={{ backgroundImage: `url(${backdrop})` }} />}
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(100deg,#111713_8%,rgba(17,23,19,.88)_48%,rgba(8,12,10,.56))]" />
        <div className="max-w-2xl">
          <p className="eyebrow">Private film journal · 2026</p>
          <h1 className="mt-4 text-5xl font-black tracking-[-.065em] text-white sm:text-7xl">A quieter place for the films that stay with you.</h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">Track the watch, keep the thought, and build a personal archive with enough space for every rewatch.</p>
          <div className="mt-8 flex flex-wrap gap-3"><Link href="/search" className="accent-button">Discover films <span aria-hidden="true" className="ml-2">→</span></Link><Link href="/diary" className="quiet-button">Open diary</Link></div>
        </div>
        {featured && <div className="mt-10 border-t border-white/10 pt-5 text-sm text-slate-300"><span className="text-slate-500">Latest memory</span><Link href={`/film/${featured.movie.id}`} className="ml-3 font-bold text-emerald-200 hover:text-emerald-100">{featured.movie.title}</Link>{featured.watchedAt && <span className="ml-2 text-slate-500">· {featured.watchedAt.getFullYear()}</span>}</div>}
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[{ label: "Films archived", value: movieCount }, { label: "Diary entries", value: logCount }, { label: "Saved favorites", value: favoriteCount }, { label: "Watchlist", value: watchlistCount }].map((stat) => <div key={stat.label} className="surface-subtle rounded-2xl px-5 py-4"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">{stat.label}</p><p className="mt-2 text-3xl font-black tracking-tight text-white">{stat.value}</p></div>)}
      </section>

      <section className="mt-14">
        <div className="mb-6 flex items-end justify-between gap-4"><div><p className="eyebrow">Recent watches</p><h2 className="mt-2 text-3xl font-black tracking-[-.04em] text-white">Fresh from the diary.</h2></div><Link href="/diary" className="text-sm font-bold text-emerald-300 hover:text-emerald-200">See all entries →</Link></div>
        {recentLogs.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">{recentLogs.map((log, index) => <MovieCard key={log.id} movie={log.movie} log={log} priority={index < 2} />)}</div> : <div className="surface-subtle rounded-3xl p-10 text-center"><p className="text-lg font-bold text-white">The archive is ready.</p><p className="mt-2 text-sm text-slate-500">Import your Letterboxd history or discover a film to begin.</p><Link href="/search" className="mt-5 inline-flex text-sm font-bold text-emerald-300">Find a film →</Link></div>}
      </section>

      <section className="mt-12 grid gap-8 lg:grid-cols-[1.3fr_.7fr]">
        <div><div className="mb-5 flex items-end justify-between"><div><p className="eyebrow">Personal canon</p><h2 className="mt-2 text-3xl font-black tracking-[-.04em] text-white">Top 10, in progress.</h2></div><Link href="/favorites" className="text-sm font-bold text-emerald-300 hover:text-emerald-200">Open Top 10 →</Link></div>{favoriteMovies.length ? <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">{favoriteMovies.map((movie) => <MovieCard key={movie.id} movie={movie} />)}</div> : <div className="surface-subtle rounded-3xl p-7"><p className="font-bold text-white">Start shaping your canon.</p><p className="mt-1 text-sm text-slate-500">Add a film from its detail page when it earns a Top 10 spot.</p></div>}</div>
        <div><div className="mb-5 flex items-end justify-between"><div><p className="eyebrow">On deck</p><h2 className="mt-2 text-3xl font-black tracking-[-.04em] text-white">Watchlist.</h2></div><Link href="/watchlist" className="text-sm font-bold text-emerald-300 hover:text-emerald-200">View all →</Link></div><div className="space-y-2">{watchlistMovies.length ? watchlistMovies.map((movie, index) => <Link key={movie.id} href={`/film/${movie.id}`} className="surface-subtle flex items-center gap-3 rounded-2xl p-3 transition hover:border-emerald-300/25"><span className="w-5 text-xs font-black text-emerald-300/70">{String(index + 1).padStart(2, "0")}</span><span className="min-w-0 flex-1 truncate text-sm font-bold text-white">{movie.title}</span><span className="text-xs text-slate-500">{movie.year ?? "—"}</span></Link>) : <div className="surface-subtle rounded-3xl p-7"><p className="font-bold text-white">Nothing queued.</p><Link href="/search" className="mt-2 inline-flex text-sm font-bold text-emerald-300">Find a film →</Link></div>}</div></div>
      </section>
    </main>
  );
}
