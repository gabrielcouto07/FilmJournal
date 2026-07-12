"use client";

import { useState } from "react";
import { getPosterUrl } from "@/lib/tmdb";

type FavoriteMovie = {
  id: string;
  title: string;
  year: number | null;
  posterPath: string | null;
  favoriteRank: number | null;
};

export default function FavoritesManager({ initialMovies }: { initialMovies: FavoriteMovie[] }) {
  const [movies, setMovies] = useState(initialMovies);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  async function setRank(movieId: string, rank: number | null) {
    const current = movies.find((movie) => movie.id === movieId);
    if (!current) return;
    const occupant = rank == null ? null : movies.find((movie) => movie.favoriteRank === rank && movie.id !== movieId);
    const previousMovies = movies;

    setMovies((items) => items.map((movie) => {
      if (movie.id === movieId) return { ...movie, favoriteRank: rank };
      if (occupant && movie.id === occupant.id) return { ...movie, favoriteRank: current.favoriteRank };
      return movie;
    }).filter((movie) => movie.favoriteRank != null).sort((left, right) => (left.favoriteRank ?? 99) - (right.favoriteRank ?? 99)));
    setPendingId(movieId);
    setNotice("");

    try {
      const response = await fetch("/api/movies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movieId, action: "favoriteRank", rank }),
      });
      const payload = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not update your Top 10.");
      setNotice(payload.message ?? "Top 10 updated.");
    } catch (error) {
      setMovies(previousMovies);
      setNotice(error instanceof Error ? error.message : "Could not update your Top 10.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {notice && <p role="status" className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] px-3 py-2 text-xs font-semibold text-emerald-100">{notice}</p>}
      <ol className="grid gap-3 sm:grid-cols-2">
        {movies.map((movie) => {
          const posterUrl = getPosterUrl(movie.posterPath);
          return <li key={movie.id} className="surface group flex min-h-32 gap-4 rounded-2xl p-3"><div className="flex w-9 shrink-0 items-start justify-center pt-1 text-2xl font-black tracking-tighter text-emerald-300/80">{String(movie.favoriteRank).padStart(2, "0")}</div><div className="h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-white/[0.04]">{posterUrl ? <img src={posterUrl} alt={`${movie.title} poster`} className="h-full w-full object-cover transition group-hover:scale-105" /> : <div className="flex h-full items-center justify-center p-1 text-center text-[10px] text-slate-500">No poster</div>}</div><div className="flex min-w-0 flex-1 flex-col py-1"><h2 className="truncate font-bold text-white">{movie.title}</h2><p className="mt-1 text-xs text-slate-500">{movie.year ?? "Year unknown"}</p><div className="mt-auto flex items-center gap-2"><label className="text-xs font-semibold text-slate-400" htmlFor={`rank-${movie.id}`}>Rank</label><select id={`rank-${movie.id}`} value={movie.favoriteRank ?? ""} disabled={pendingId === movie.id} onChange={(event) => setRank(movie.id, event.target.value ? Number(event.target.value) : null)} className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-white outline-none"><option value="">Remove</option>{Array.from({ length: 10 }, (_, index) => index + 1).map((rank) => <option key={rank} value={rank}>#{rank}</option>)}</select></div></div></li>;
        })}
      </ol>
    </div>
  );
}
