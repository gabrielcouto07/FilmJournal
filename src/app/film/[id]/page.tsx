import Link from "next/link";
import { notFound } from "next/navigation";
import CollectionControls from "@/components/CollectionControls";
import FavoriteToggle from "@/components/FavoriteToggle";
import StarRating from "@/components/StarRating";
import { getPosterUrl } from "@/lib/tmdb";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type FilmPageProps = { params: Promise<{ id: string }> };

function formatDate(date: Date | null) {
  return date ? new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric" }).format(date) : "Date not recorded";
}

export default async function FilmPage({ params }: FilmPageProps) {
  const { id } = await params;
  const movie = await prisma.movie.findUnique({
    where: { id },
    include: { logs: { orderBy: [{ watchedAt: "desc" }, { loggedAt: "desc" }] } },
  });
  if (!movie) notFound();

  const logs = movie.logs.filter((entry, index, entries) => entries.findIndex((candidate) => (candidate.dedupeKey ?? candidate.id) === (entry.dedupeKey ?? entry.id)) === index);
  const posterUrl = getPosterUrl(movie.posterPath);
  const backdropUrl = getPosterUrl(movie.backdropPath);
  const ratedLogs = logs.filter((log) => log.rating != null);
  const averageRating = ratedLogs.length ? ratedLogs.reduce((total, log) => total + (log.rating ?? 0), 0) / ratedLogs.length : null;
  const imdbUrl = movie.imdbId ? `https://www.imdb.com/title/${movie.imdbId}/` : null;

  return (
    <main className="page-shell max-w-6xl">
      <Link href="/diary" className="text-sm font-bold text-emerald-300 hover:text-emerald-200">← Back to diary</Link>

      <section className="surface relative mt-6 isolate overflow-hidden rounded-[2rem] p-6 sm:p-10">
        {backdropUrl && <div className="absolute inset-0 -z-20 bg-cover bg-center opacity-30" style={{ backgroundImage: `url(${backdropUrl})` }} />}
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(100deg,#111713_8%,rgba(17,23,19,.94)_48%,rgba(9,12,10,.7))]" />
        <div className="flex flex-col gap-8 sm:flex-row sm:items-end">
          <div className="w-36 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/20 shadow-2xl sm:w-48">
            {posterUrl ? <img src={posterUrl} alt={`${movie.title} poster`} className="aspect-[2/3] w-full object-cover" /> : <div className="flex aspect-[2/3] items-center justify-center p-4 text-center text-sm text-slate-500">Poster unavailable</div>}
          </div>
          <div className="max-w-2xl">
            <p className="eyebrow">Film file {movie.tmdbId ? `· TMDb ${movie.tmdbId}` : ""}</p>
            <h1 className="mt-3 text-4xl font-black tracking-[-.055em] text-white sm:text-6xl">{movie.title}</h1>
            <p className="mt-3 text-sm text-emerald-200">{[movie.year, movie.runtime ? `${movie.runtime} min` : null, movie.genres].filter(Boolean).join(" · ")}</p>
            {movie.tagline && <p className="mt-5 text-lg italic text-slate-300">“{movie.tagline}”</p>}
            <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">{movie.overview || "No overview has been added for this film yet."}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <div className="surface-subtle rounded-2xl px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">Watches</p><p className="mt-1 text-2xl font-black text-white">{logs.length}</p></div>
              {averageRating != null && <div className="surface-subtle rounded-2xl px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">Your average</p><div className="mt-1"><StarRating value={averageRating} readOnly showValue /></div></div>}
              {movie.watchlist && <div className="surface-subtle rounded-2xl px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">Status</p><p className="mt-1 text-sm font-bold text-emerald-200">On watchlist</p></div>}
            </div>
            <div className="mt-5"><CollectionControls movieId={movie.id} initialWatchlist={movie.watchlist} initialFavoriteRank={movie.favoriteRank} /></div>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="surface-subtle rounded-2xl p-4"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">TMDb</p><p className="mt-2 text-sm font-bold text-white">{movie.tmdbId ? `Movie #${movie.tmdbId}` : "No TMDb id"}</p></div>
        <div className="surface-subtle rounded-2xl p-4"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">IMDb</p>{imdbUrl ? <a href={imdbUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-sm font-bold text-emerald-200 hover:text-emerald-100">{movie.imdbId} ↗</a> : <p className="mt-2 text-sm text-slate-500">No external ID available</p>}</div>
        <div className="surface-subtle rounded-2xl p-4"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">External notes</p><p className="mt-2 text-sm leading-5 text-slate-400">IMDb ratings are not supplied by TMDb, so this archive shows verified identifiers without scraping a separate service.</p></div>
      </section>

      <section className="mt-12 max-w-4xl">
        <div className="mb-6"><p className="eyebrow">Your history</p><h2 className="mt-2 text-3xl font-black tracking-[-.04em] text-white">Every time it returned.</h2></div>
        {logs.length ? <div className="space-y-3">{logs.map((log) => <article key={log.id} className="surface-subtle rounded-2xl p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-slate-500">{formatDate(log.watchedAt ?? log.loggedAt)}{log.rewatch ? " · Rewatch" : ""}</p>{log.rating != null && <div className="mt-2"><StarRating value={log.rating} readOnly showValue /></div>}</div><FavoriteToggle logId={log.id} initialFavorite={log.favorite} /></div>{log.review && <p className="mt-4 whitespace-pre-wrap border-l border-emerald-300/35 pl-4 text-sm leading-7 text-slate-300">{log.review}</p>}</article>)}</div> : <div className="surface-subtle rounded-3xl p-10 text-center"><p className="font-bold text-white">This film is in your archive, not your diary — yet.</p><Link href="/search" className="mt-4 inline-flex text-sm font-bold text-emerald-300">Discover more films →</Link></div>}
      </section>
    </main>
  );
}
