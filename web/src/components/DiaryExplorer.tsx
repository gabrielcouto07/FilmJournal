"use client";

import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { useMemo, useState } from "react";
import { getPosterUrl } from "@/lib/tmdb";
import ArtworkImage from "./ArtworkImage";
import FavoriteToggle from "./FavoriteToggle";
import StarRating from "./StarRating";
import { useToast } from "./ToastProvider";

export type DiaryItem = {
  id: string;
  watchedAt: string | null;
  loggedAt: string | null;
  rating: number | null;
  review: string | null;
  rewatch: boolean;
  tags: string | null;
  movie: { id: string; title: string; year: number | null; genres: string | null; posterPath: string | null; preferredPosterPath: string | null; favorite: boolean };
};

type View = "list" | "posters" | "calendar";

function dateOf(item: DiaryItem): Date | null {
  const value = item.watchedAt ?? item.loggedAt;
  return value ? new Date(value) : null;
}
function dateLabel(item: DiaryItem): string {
  const date = dateOf(item);
  return date ? new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date) : "Data desconhecida";
}
function monthKey(item: DiaryItem): string {
  const date = dateOf(item);
  return date ? `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}` : "undated";
}
function monthLabel(key: string): string {
  if (key === "undated") return "Sem data";
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export default function DiaryExplorer({ entries: initialEntries }: { entries: DiaryItem[] }) {
  const { notify } = useToast();
  const [entries, setEntries] = useState(initialEntries);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("all");
  const [minRating, setMinRating] = useState("0");
  const [maxRating, setMaxRating] = useState("5");
  const [reviewed, setReviewed] = useState("all");
  const [rewatch, setRewatch] = useState("all");
  const [favorite, setFavorite] = useState(false);
  const [genre, setGenre] = useState("all");
  const [sort, setSort] = useState("newest");
  const [view, setView] = useState<View>("list");

  const years = useMemo(() => [...new Set(entries.map((item) => dateOf(item)?.getUTCFullYear()).filter((value): value is number => Boolean(value)))].sort((a, b) => b - a), [entries]);
  const genres = useMemo(() => [...new Set(entries.flatMap((item) => item.movie.genres?.split(",").map((value) => value.trim()).filter(Boolean) ?? []))].sort(), [entries]);
  const filtered = useMemo(() => entries.filter((item) => {
    const itemDate = dateOf(item);
    const normalized = query.trim().toLowerCase();
    if (normalized && !`${item.movie.title} ${item.review ?? ""} ${item.tags ?? ""}`.toLowerCase().includes(normalized)) return false;
    if (year !== "all" && itemDate?.getUTCFullYear() !== Number(year)) return false;
    if (item.rating == null ? Number(minRating) > 0 : item.rating < Number(minRating) || item.rating > Number(maxRating)) return false;
    if (reviewed === "yes" && !item.review?.trim()) return false;
    if (reviewed === "no" && item.review?.trim()) return false;
    if (rewatch === "yes" && !item.rewatch) return false;
    if (rewatch === "no" && item.rewatch) return false;
    if (favorite && !item.movie.favorite) return false;
    if (genre !== "all" && !item.movie.genres?.split(",").map((value) => value.trim()).includes(genre)) return false;
    return true;
  }).sort((left, right) => {
    if (sort === "title") return left.movie.title.localeCompare(right.movie.title);
    if (sort === "rating") return (right.rating ?? -1) - (left.rating ?? -1);
    const difference = (dateOf(right)?.getTime() ?? 0) - (dateOf(left)?.getTime() ?? 0);
    return sort === "oldest" ? -difference : difference;
  }), [entries, favorite, genre, maxRating, minRating, query, reviewed, rewatch, sort, year]);

  const grouped = useMemo(() => {
    const map = new Map<string, DiaryItem[]>();
    filtered.forEach((item) => map.set(monthKey(item), [...(map.get(monthKey(item)) ?? []), item]));
    return [...map.entries()];
  }, [filtered]);

  async function deleteEntry(item: DiaryItem) {
    setDeletingId(item.id);
    try {
      const response = await apiFetch(`/logs?id=${item.id}`, { method: "DELETE" });
      const payload = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível excluir esta entrada.");
      setEntries((items) => items.filter((entry) => entry.id !== item.id));
      notify(payload.message ?? "Entrada excluída do diário.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível excluir esta entrada.", "error");
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  }

  return <div>
    <section className="surface sticky top-[7.15rem] z-20 rounded-[1.5rem] p-3 sm:top-20 sm:p-4">
      <div className="grid gap-3 xl:grid-cols-[minmax(14rem,1fr)_repeat(6,auto)]">
        <label className="relative"><span className="sr-only">Buscar no diário</span><span className="pointer-events-none absolute left-3 top-2.5 text-slate-500">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar filmes, avaliações, tags…" className="field !pl-9" /></label>
        <select value={year} onChange={(event) => setYear(event.target.value)} className="field !w-auto" aria-label="Ano da exibição"><option value="all">Todos os anos</option>{years.map((value) => <option key={value}>{value}</option>)}</select>
        <div className="flex gap-1"><select value={minRating} onChange={(event) => setMinRating(event.target.value)} className="field !w-auto" aria-label="Nota mínima">{[0,.5,1,1.5,2,2.5,3,3.5,4,4.5,5].map((value) => <option key={value} value={value}>Mín {value || "qualquer"}</option>)}</select><select value={maxRating} onChange={(event) => setMaxRating(event.target.value)} className="field !w-auto" aria-label="Nota máxima">{[.5,1,1.5,2,2.5,3,3.5,4,4.5,5].map((value) => <option key={value} value={value}>Máx {value}</option>)}</select></div>
        <select value={reviewed} onChange={(event) => setReviewed(event.target.value)} className="field !w-auto" aria-label="Filtro de avaliação"><option value="all">Quaisquer notas</option><option value="yes">Avaliados</option><option value="no">Sem avaliação</option></select>
        <select value={rewatch} onChange={(event) => setRewatch(event.target.value)} className="field !w-auto" aria-label="Filtro de reexibição"><option value="all">Todas as exibições</option><option value="yes">Reexibições</option><option value="no">Primeiras exibições</option></select>
        <select value={genre} onChange={(event) => setGenre(event.target.value)} className="field !w-auto" aria-label="Filtro de gênero"><option value="all">Todos os gêneros</option>{genres.map((value) => <option key={value}>{value}</option>)}</select>
        <select value={sort} onChange={(event) => setSort(event.target.value)} className="field !w-auto" aria-label="Ordenar diário"><option value="newest">Mais recentes</option><option value="oldest">Mais antigos</option><option value="rating">Maior nota</option><option value="title">Título A–Z</option></select>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3"><div className="flex items-center gap-2"><button type="button" onClick={() => setFavorite((value) => !value)} className={`chip ${favorite ? "chip-active" : ""}`}>♥ Favoritos</button><span className="text-xs font-bold tabular-nums text-slate-500">{filtered.length} de {entries.length} entradas</span></div><div className="flex rounded-full border border-white/[0.08] bg-black/20 p-1">{(["list", "posters", "calendar"] as View[]).map((mode) => <button type="button" key={mode} onClick={() => setView(mode)} className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize transition ${view === mode ? "bg-amber-300 text-black" : "text-slate-500 hover:text-white"}`}>{({ list: "Lista", posters: "Pôsteres", calendar: "Calendário" })[mode]}</button>)}</div></div>
    </section>

    {!filtered.length ? <div className="empty-state mt-6"><p className="text-lg font-bold text-white">Nenhuma entrada corresponde a este recorte.</p><p className="mt-2 text-sm text-slate-500">Amplie a faixa de notas ou limpe um filtro para trazer os filmes de volta.</p></div> : view === "list" ? <div className="mt-8 space-y-10">{grouped.map(([key, items]) => <section key={key}><div className="mb-4 flex items-center gap-4"><h2 className="text-xl font-black tracking-tight text-white">{monthLabel(key)}</h2><span className="h-px flex-1 bg-white/[0.07]" /><span className="text-xs font-bold text-slate-600">{items.length}</span></div><div className="space-y-3">{items.map((item) => {
      const preferredPoster = getPosterUrl(item.movie.preferredPosterPath); const defaultPoster = getPosterUrl(item.movie.posterPath);
      return <article key={item.id} className="surface group rounded-[1.4rem] p-3 sm:p-4"><div className="flex gap-4 sm:gap-5"><Link href={`/film/${item.movie.id}`} className="h-28 w-[4.7rem] shrink-0 overflow-hidden rounded-xl bg-white/[0.04] sm:h-36 sm:w-24"><ArtworkImage src={preferredPoster} fallbackSrc={defaultPoster} alt={`Pôster de ${item.movie.title}`} title={item.movie.title} className="h-full w-full" sizes="96px" /></Link><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow !text-slate-500">{dateLabel(item)} {item.rewatch ? "· Reexibição" : ""}</p><Link href={`/film/${item.movie.id}`} className="mt-1 block text-xl font-black tracking-tight text-white transition hover:text-amber-200 sm:text-2xl">{item.movie.title} <span className="text-base font-medium text-slate-600">{item.movie.year}</span></Link></div><div className="flex items-center gap-3">{item.rating != null && <StarRating value={item.rating} readOnly showValue />}<FavoriteToggle movieId={item.movie.id} initialFavorite={item.movie.favorite} compact />{confirmId === item.id ? <span className="flex items-center gap-1.5"><button type="button" onClick={() => deleteEntry(item)} disabled={deletingId === item.id} className="rounded-full bg-red-500/90 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-red-500 disabled:opacity-60">{deletingId === item.id ? "Excluindo…" : "Excluir"}</button><button type="button" onClick={() => setConfirmId(null)} className="quiet-button !px-3 !py-1.5 text-xs">Cancelar</button></span> : <button type="button" onClick={() => setConfirmId(item.id)} aria-label={`Excluir entrada de ${item.movie.title}`} className="icon-button h-9 w-9 hover:!border-red-400/50 hover:!bg-red-500/10 hover:!text-red-300">🗑</button>}</div></div>{item.review ? <p className="mt-3 line-clamp-3 max-w-4xl border-l border-amber-300/35 pl-4 text-sm leading-6 text-slate-300">{item.review}</p> : <p className="mt-3 text-sm italic text-slate-600">Sem nota para esta exibição.</p>}{item.tags && <div className="mt-3 flex flex-wrap gap-1.5">{item.tags.split(",").map((tag) => <span key={tag} className="chip !px-2 !py-1 text-[9px] uppercase tracking-wider">{tag.trim()}</span>)}</div>}</div></div></article>;
    })}</div></section>)}</div> : view === "posters" ? <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">{filtered.map((item) => { const preferredPoster = getPosterUrl(item.movie.preferredPosterPath); const defaultPoster = getPosterUrl(item.movie.posterPath); return <Link href={`/film/${item.movie.id}`} key={item.id} className="poster-card group overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03]"><div className="relative aspect-[2/3]"><ArtworkImage src={preferredPoster} fallbackSrc={defaultPoster} alt={`Pôster de ${item.movie.title}`} title={item.movie.title} className="h-full w-full" sizes="(max-width: 640px) 30vw, 140px" /><div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black p-2 pt-8"><p className="truncate text-[11px] font-bold text-white">{item.movie.title}</p><p className="text-[9px] text-slate-400">{dateLabel(item)}</p></div></div></Link>; })}</div> : <CalendarView groups={grouped} />}
  </div>;
}

function CalendarView({ groups }: { groups: Array<[string, DiaryItem[]]> }) {
  return <div className="mt-8 space-y-8">{groups.filter(([key]) => key !== "undated").map(([key, items]) => {
    const [year, month] = key.split("-").map(Number);
    const firstDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    const totalDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const byDay = new Map<number, DiaryItem[]>();
    items.forEach((item) => { const day = dateOf(item)?.getUTCDate(); if (day) byDay.set(day, [...(byDay.get(day) ?? []), item]); });
    return <section key={key} className="surface rounded-[1.6rem] p-4 sm:p-6"><h2 className="section-heading mb-5">{monthLabel(key)}</h2><div className="grid grid-cols-7 gap-1 text-center text-[9px] font-black uppercase tracking-wider text-slate-600">{["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((day) => <span key={day}>{day}</span>)}</div><div className="mt-2 grid grid-cols-7 gap-1.5">{Array.from({ length: firstDay }, (_, index) => <div key={`blank-${index}`} />)}{Array.from({ length: totalDays }, (_, index) => index + 1).map((day) => <div key={day} className="min-h-20 rounded-lg border border-white/[0.06] bg-black/15 p-1.5 sm:min-h-28"><span className="text-[10px] font-bold text-slate-600">{day}</span><div className="mt-1 grid grid-cols-2 gap-1">{(byDay.get(day) ?? []).map((item) => { const preferredPoster = getPosterUrl(item.movie.preferredPosterPath); const defaultPoster = getPosterUrl(item.movie.posterPath); return <Link href={`/film/${item.movie.id}`} key={item.id} title={item.movie.title} className="overflow-hidden rounded bg-white/[0.04]"><ArtworkImage src={preferredPoster} fallbackSrc={defaultPoster} alt="" title={item.movie.title} className="aspect-[2/3] w-full" sizes="64px" /></Link>; })}</div></div>)}</div></section>;
  })}</div>;
}
