import Link from "next/link";
import type { LogEntry, Movie } from "@prisma/client";
import { getPosterUrl } from "@/lib/tmdb";
import FavoriteToggle from "./FavoriteToggle";
import StarRating from "./StarRating";

type MovieCardProps = { movie: Movie; log?: LogEntry | null; priority?: boolean };

export default function MovieCard({ movie, log, priority = false }: MovieCardProps) {
  const posterUrl = getPosterUrl(movie.posterPath);

  return (
    <article className="group overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111613] shadow-[0_12px_40px_rgba(0,0,0,.2)] transition duration-300 hover:-translate-y-1 hover:border-emerald-300/35 hover:shadow-[0_24px_60px_rgba(0,0,0,.36)]">
      <Link href={`/film/${movie.id}`} className="block">
        <div className="relative aspect-[2/3] overflow-hidden bg-[#18201b]">
          {posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={posterUrl} alt={`${movie.title} poster`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading={priority ? "eager" : "lazy"} />
          ) : <div className="flex h-full items-center justify-center p-5 text-center text-xs text-slate-500">Poster unavailable</div>}
          <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[#0b0e0c] to-transparent" />
          {movie.favoriteRank != null && <div className="absolute left-3 top-3 rounded-full border border-emerald-300/35 bg-[#0a120d]/80 px-2 py-1 text-[10px] font-black tracking-[.12em] text-emerald-200 backdrop-blur">TOP #{movie.favoriteRank}</div>}
          {log?.rating != null && <div className="absolute bottom-3 left-3 rounded-full border border-white/10 bg-black/45 px-2 py-1 backdrop-blur"><StarRating value={log.rating} readOnly size="sm" /></div>}
        </div>
        <div className="space-y-1.5 p-3.5">
          <h2 className="truncate text-sm font-bold tracking-tight text-white">{movie.title}</h2>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{movie.year ?? "Year unknown"}</span>
            {log?.rewatch && <span className="text-emerald-300">Rewatch</span>}
          </div>
        </div>
      </Link>
      {log && <div className="flex justify-end border-t border-white/[0.06] px-3 py-2"><FavoriteToggle logId={log.id} initialFavorite={log.favorite} compact /></div>}
    </article>
  );
}
