"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { getPosterUrl } from "@/lib/tmdb";
import ArtworkImage from "./ArtworkImage";
import LogEditor from "./LogEditor";
import { useToast } from "./ToastProvider";

export type WatchlistMovie = {
  id: string; title: string; year: number | null; releaseDate: string | null; runtime: number | null;
  genres: string | null; overview: string | null; posterPath: string | null; preferredPosterPath: string | null;
  watchlistAddedAt: string | null; tmdbRating: number | null;
};

export default function WatchlistExplorer({ initialMovies }: { initialMovies: WatchlistMovie[] }) {
  const [movies, setMovies] = useState(initialMovies);
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("all");
  const [year, setYear] = useState("all");
  const [sort, setSort] = useState("added");
  const [view, setView] = useState<"grid" | "list">("grid");
  const { notify } = useToast();

  const genres = useMemo(() => [...new Set(movies.flatMap((movie) => movie.genres?.split(",").map((value) => value.trim()).filter(Boolean) ?? []))].sort(), [movies]);
  const years = useMemo(() => [...new Set(movies.map((movie) => movie.year).filter((value): value is number => value != null))].sort((a,b) => b-a), [movies]);
  const visible = useMemo(() => movies.filter((movie) => {
    if (query && !movie.title.toLowerCase().includes(query.toLowerCase())) return false;
    if (genre !== "all" && !movie.genres?.split(",").map((value) => value.trim()).includes(genre)) return false;
    if (year !== "all" && movie.year !== Number(year)) return false;
    return true;
  }).sort((left, right) => {
    if (sort === "title") return left.title.localeCompare(right.title);
    if (sort === "release") return (right.releaseDate ?? "").localeCompare(left.releaseDate ?? "");
    if (sort === "rating") return (right.tmdbRating ?? -1) - (left.tmdbRating ?? -1);
    if (sort === "runtime") return (left.runtime ?? Number.MAX_SAFE_INTEGER) - (right.runtime ?? Number.MAX_SAFE_INTEGER);
    return (right.watchlistAddedAt ?? "").localeCompare(left.watchlistAddedAt ?? "");
  }), [genre, movies, query, sort, year]);

  async function remove(movie: WatchlistMovie) {
    const previous = movies;
    setMovies((items) => items.filter((item) => item.id !== movie.id));
    try {
      const response = await fetch("/api/movies", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ movieId: movie.id, action: "watchlist", value: false }) });
      const payload = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível remover este filme.");
      notify(payload.message ?? "Removido da Watchlist.");
    } catch (error) { setMovies(previous); notify(error instanceof Error ? error.message : "Não foi possível remover este filme.", "error"); }
  }

  return <div>
    <section className="surface rounded-[1.5rem] p-3 sm:p-4"><div className="grid gap-3 md:grid-cols-[1fr_repeat(3,auto)]"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filtrar a fila…" className="field" /><select value={genre} onChange={(event) => setGenre(event.target.value)} className="field !w-auto"><option value="all">Todos os gêneros</option>{genres.map((value) => <option key={value}>{value}</option>)}</select><select value={year} onChange={(event) => setYear(event.target.value)} className="field !w-auto"><option value="all">Todos os anos</option>{years.map((value) => <option key={value}>{value}</option>)}</select><select value={sort} onChange={(event) => setSort(event.target.value)} className="field !w-auto"><option value="added">Adicionados recentemente</option><option value="release">Data de lançamento</option><option value="rating">Nota TMDb</option><option value="title">Título</option><option value="runtime">Menor duração</option></select></div><div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3"><p className="text-xs font-bold text-slate-500">{visible.length} de {movies.length} na fila</p><div className="flex rounded-full border border-white/[0.08] p-1">{(["grid","list"] as const).map((mode) => <button key={mode} type="button" onClick={() => setView(mode)} className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${view === mode ? "bg-amber-300 text-black" : "text-slate-500"}`}>{({ grid: "Grade", list: "Lista" })[mode]}</button>)}</div></div></section>
    {!visible.length ? <div className="empty-state mt-6"><p className="text-lg font-bold text-white">Nenhum filme na sua Watchlist.</p><p className="mt-2 text-sm text-slate-500">Altere os filtros ou descubra um filme que valha a pena salvar.</p><Link href="/search" className="accent-button mt-5">Descobrir filmes</Link></div> : view === "grid" ? <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">{visible.map((movie) => {
      const preferredPoster = getPosterUrl(movie.preferredPosterPath); const defaultPoster = getPosterUrl(movie.posterPath);
      return <article key={movie.id} className="poster-card group overflow-hidden rounded-[1.15rem] border border-white/[0.09] bg-[#141414]"><Link href={`/film/${movie.id}`} className="block"><div className="relative aspect-[2/3] bg-white/[0.04]"><ArtworkImage src={preferredPoster} fallbackSrc={defaultPoster} alt={`Pôster de ${movie.title}`} title={movie.title} className="h-full w-full" sizes="(max-width: 640px) 45vw, 190px" /><div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black p-3 pt-12"><h2 className="truncate text-sm font-black text-white">{movie.title}</h2><p className="mt-1 text-[10px] font-bold text-slate-400">{movie.year ?? "—"}{movie.runtime ? ` · ${movie.runtime}m` : ""}</p></div></div></Link><div className="flex gap-1.5 border-t border-white/[0.06] p-2"><LogEditor movieId={movie.id} title={movie.title} label="Registrar" compact onSaved={() => setMovies((items) => items.filter((item) => item.id !== movie.id))} /><button type="button" onClick={() => remove(movie)} className="icon-button h-9 w-9" aria-label={`Remover ${movie.title} da Watchlist`}>×</button></div></article>;
    })}</div> : <div className="mt-6 space-y-2">{visible.map((movie) => { const preferredPoster = getPosterUrl(movie.preferredPosterPath); const defaultPoster = getPosterUrl(movie.posterPath); return <article key={movie.id} className="surface flex gap-4 rounded-2xl p-3"><Link href={`/film/${movie.id}`} className="h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-white/[0.04]"><ArtworkImage src={preferredPoster} fallbackSrc={defaultPoster} alt={`Pôster de ${movie.title}`} title={movie.title} className="h-full w-full" sizes="64px" /></Link><div className="min-w-0 flex-1 py-1"><div className="flex flex-wrap items-start justify-between gap-3"><div><Link href={`/film/${movie.id}`} className="font-black text-white hover:text-amber-200">{movie.title}</Link><p className="mt-1 text-xs text-slate-500">{[movie.year, movie.genres, movie.runtime ? `${movie.runtime} min` : null].filter(Boolean).join(" · ")}</p></div><div className="flex gap-2"><LogEditor movieId={movie.id} title={movie.title} compact onSaved={() => setMovies((items) => items.filter((item) => item.id !== movie.id))} /><button type="button" onClick={() => remove(movie)} className="quiet-button !px-3 !py-2 text-xs">Remover</button></div></div><p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{movie.overview || "Sinopse indisponível."}</p></div></article>; })}</div>}
  </div>;
}
