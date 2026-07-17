"use client";

import Link from "next/link";
import { useState } from "react";
import { getPosterUrl } from "@/lib/tmdb";
import ArtworkImage from "./ArtworkImage";
import { useToast } from "./ToastProvider";

type FavoriteMovie = { id: string; title: string; year: number | null; posterPath: string | null; preferredPosterPath: string | null; favoriteRank: number | null; favorite: boolean; genres: string | null };

export default function FavoritesManager({ initialMovies }: { initialMovies: FavoriteMovie[] }) {
  const [movies, setMovies] = useState(initialMovies);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const { notify } = useToast();
  const ranked = movies.filter((movie) => movie.favoriteRank != null).sort((a,b) => (a.favoriteRank ?? 99) - (b.favoriteRank ?? 99));
  const unranked = movies.filter((movie) => movie.favorite && movie.favoriteRank == null);

  async function update(movieId: string, action: "favoriteRank" | "top10", value: number | boolean | null) {
    const previous = movies;
    const moving = movies.find((movie) => movie.id === movieId);
    if (!moving) return;
    setPendingId(movieId);
    if (action === "favoriteRank") {
      const nextRank = value as number | null;
      const occupant = movies.find((movie) => movie.favoriteRank === nextRank && movie.id !== movieId);
      setMovies((items) => items.map((movie) => movie.id === movieId ? { ...movie, favoriteRank: nextRank } : occupant && movie.id === occupant.id ? { ...movie, favoriteRank: moving.favoriteRank } : movie));
    }
    try {
      const response = await fetch("/api/movies", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action === "favoriteRank" ? { movieId, action, rank: value } : { movieId, action, value }) });
      const payload = await response.json() as { movie?: FavoriteMovie; message?: string; error?: string };
      if (!response.ok || !payload.movie) throw new Error(payload.error ?? "Não foi possível atualizar seu Top 10.");
      setMovies((items) => items.map((movie) => movie.id === movieId ? { ...movie, favoriteRank: payload.movie?.favoriteRank ?? null } : movie));
      notify(payload.message ?? "Top 10 atualizado.");
    } catch (error) { setMovies(previous); notify(error instanceof Error ? error.message : "Não foi possível atualizar seu Top 10.", "error"); }
    finally { setPendingId(null); }
  }

  return <div className="space-y-12">
    {ranked.length ? <ol className="space-y-3">{ranked.map((movie) => {
      const preferredPoster = getPosterUrl(movie.preferredPosterPath); const defaultPoster = getPosterUrl(movie.posterPath);
      return <li key={movie.id} className="surface group grid grid-cols-[3rem_5.5rem_1fr] gap-4 rounded-[1.4rem] p-3 sm:grid-cols-[5rem_7rem_1fr_auto] sm:items-center sm:gap-6 sm:p-4"><div className="text-center text-3xl font-black tracking-[-.08em] text-amber-300/80 sm:text-5xl">{String(movie.favoriteRank).padStart(2,"0")}</div><Link href={`/film/${movie.id}`} className="overflow-hidden rounded-xl bg-white/[0.04]"><div className="aspect-[2/3]"><ArtworkImage src={preferredPoster} fallbackSrc={defaultPoster} alt={`Pôster de ${movie.title}`} title={movie.title} className="h-full w-full" sizes="112px" /></div></Link><div className="min-w-0"><Link href={`/film/${movie.id}`} className="text-xl font-black tracking-tight text-white hover:text-amber-200 sm:text-2xl">{movie.title}</Link><p className="mt-1 text-xs font-bold text-slate-500">{movie.year ?? "—"} · {movie.genres ?? "Sem classificação"}</p><p className="mt-3 text-xs leading-5 text-slate-500">Posição {movie.favoriteRank} no seu cânone pessoal.</p></div><div className="col-span-3 flex justify-end gap-2 sm:col-span-1"><button type="button" disabled={pendingId != null || movie.favoriteRank === 1} onClick={() => update(movie.id,"favoriteRank",(movie.favoriteRank ?? 1)-1)} className="icon-button h-9 w-9" aria-label={`Mover ${movie.title} para cima`}>↑</button><button type="button" disabled={pendingId != null || movie.favoriteRank === 10 || movie.favoriteRank === ranked.length} onClick={() => update(movie.id,"favoriteRank",(movie.favoriteRank ?? 1)+1)} className="icon-button h-9 w-9" aria-label={`Mover ${movie.title} para baixo`}>↓</button><button type="button" disabled={pendingId != null} onClick={() => update(movie.id,"favoriteRank",null)} className="quiet-button !px-3 !py-2 text-xs">Remover</button></div></li>;
    })}</ol> : <div className="empty-state"><p className="text-lg font-bold text-white">Seu Top 10 tem lugares vagos.</p><p className="mt-2 text-sm text-slate-500">Favorite um filme e depois promova-o abaixo.</p></div>}
    <section><div className="mb-5 flex items-end justify-between gap-4"><div><p className="eyebrow">Além do ranking</p><h2 className="section-heading mt-2">Filmes favoritos.</h2></div><span className="text-xs font-bold text-slate-500">{movies.filter((movie) => movie.favorite).length} favoritos</span></div>{unranked.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7">{unranked.map((movie) => { const preferredPoster = getPosterUrl(movie.preferredPosterPath); const defaultPoster = getPosterUrl(movie.posterPath); return <article key={movie.id} className="poster-card overflow-hidden rounded-[1rem] border border-white/[0.08] bg-[#141414]"><Link href={`/film/${movie.id}`} className="block"><div className="aspect-[2/3] bg-white/[0.04]"><ArtworkImage src={preferredPoster} fallbackSrc={defaultPoster} alt={`Pôster de ${movie.title}`} title={movie.title} className="h-full w-full" sizes="(max-width: 640px) 45vw, 190px" /></div><p className="truncate p-3 pb-1 text-sm font-bold text-white">{movie.title}</p></Link><button type="button" disabled={pendingId != null || ranked.length >= 10} onClick={() => update(movie.id,"top10",true)} className="m-2 mt-1 w-[calc(100%-1rem)] rounded-lg border border-amber-300/20 bg-amber-300/[0.06] py-2 text-[10px] font-black uppercase tracking-wider text-amber-200 disabled:opacity-40">Promover ao Top 10</button></article>; })}</div> : <p className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 text-sm text-slate-500">Filmes favoritados em qualquer visão de detalhe, diário ou descoberta aparecerão aqui.</p>}</section>
  </div>;
}
