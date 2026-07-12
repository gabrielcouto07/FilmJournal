import Link from "next/link";
import FavoriteToggle from "@/components/FavoriteToggle";
import StarRating from "@/components/StarRating";
import { getPosterUrl } from "@/lib/tmdb";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getDiary() {
  try {
    const entries = await prisma.logEntry.findMany({ include: { movie: true }, orderBy: [{ watchedAt: "desc" }, { loggedAt: "desc" }] });
    return entries.filter((entry, index) => entries.findIndex((candidate) => (candidate.dedupeKey ?? candidate.id) === (entry.dedupeKey ?? entry.id)) === index);
  } catch {
    return [];
  }
}

function formatWatchDate(date: Date | null) {
  return date ? new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(date) : "Date not recorded";
}

export default async function DiaryPage() {
  const logs = await getDiary();
  const reviewedCount = logs.filter((log) => log.review?.trim()).length;

  return (
    <main className="page-shell max-w-6xl">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div><p className="eyebrow">Personal record</p><h1 className="mt-3 text-5xl font-black tracking-[-.055em] text-white sm:text-6xl">The diary.</h1><p className="mt-4 max-w-xl text-base leading-7 text-slate-400">A chronological shelf of every watch, thought, and return visit.</p></div>
        <div className="surface-subtle rounded-2xl px-5 py-4 text-right"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">Entries shown</p><p className="mt-1 text-3xl font-black text-emerald-200">{logs.length}</p><p className="mt-1 text-xs text-slate-500">{reviewedCount} with a note</p></div>
      </header>

      {logs.length ? <div className="space-y-4">{logs.map((log) => {
        const posterUrl = getPosterUrl(log.movie.posterPath);
        return <article key={log.id} className="surface group relative overflow-hidden rounded-3xl p-3 sm:p-5">
          <div className="flex gap-4 sm:gap-6">
            <Link href={`/film/${log.movie.id}`} className="h-32 w-20 shrink-0 overflow-hidden rounded-xl bg-white/[0.04] sm:h-40 sm:w-28">{posterUrl ? <img src={posterUrl} alt={`${log.movie.title} poster`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <span className="flex h-full items-center justify-center p-2 text-center text-[10px] text-slate-500">No poster</span>}</Link>
            <div className="min-w-0 flex-1 py-1"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.17em] text-slate-500">{formatWatchDate(log.watchedAt ?? log.loggedAt)}</p><Link href={`/film/${log.movie.id}`} className="mt-1 block text-xl font-black tracking-tight text-white transition hover:text-emerald-200 sm:text-2xl">{log.movie.title}</Link><p className="mt-1 text-sm text-slate-500">{log.movie.year ?? "Year unknown"}{log.rewatch ? <span className="ml-2 text-emerald-300">· Rewatch</span> : null}</p></div><div className="flex items-center gap-3">{log.rating != null && <StarRating value={log.rating} readOnly showValue />}<FavoriteToggle logId={log.id} initialFavorite={log.favorite} compact /></div></div>
              {log.review ? <p className="mt-4 max-w-3xl whitespace-pre-wrap border-l border-emerald-300/35 pl-4 text-sm leading-7 text-slate-300">{log.review}</p> : <p className="mt-4 text-sm italic text-slate-600">No note captured for this watch.</p>}
              {log.tags && <div className="mt-4 flex flex-wrap gap-2">{log.tags.split(",").map((tag) => tag.trim()).filter(Boolean).map((tag) => <span key={tag} className="rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.13em] text-slate-400">{tag}</span>)}</div>}
            </div>
          </div>
        </article>;
      })}</div> : <div className="surface-subtle rounded-3xl p-12 text-center"><p className="text-lg font-bold text-white">No entries yet.</p><p className="mt-2 text-sm text-slate-500">Your diary will appear here as soon as the first film lands in the archive.</p><Link href="/search" className="mt-5 inline-flex text-sm font-bold text-emerald-300">Discover a film →</Link></div>}
    </main>
  );
}
