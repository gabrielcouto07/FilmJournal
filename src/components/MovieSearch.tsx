"use client";

import { useEffect, useState } from "react";
import { getPosterUrl } from "@/lib/tmdb";

type ExistingMovie = { id: string; updatedAt: string; watchlist: boolean; favoriteRank: number | null } | null;
type SearchResult = {
  id: number;
  title: string;
  release_date?: string;
  poster_path?: string | null;
  overview?: string;
  vote_average?: number;
  popularity?: number;
  existing: ExistingMovie;
};

type SearchResponse = { results: SearchResult[]; total_results: number; error?: string };

export default function MovieSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "empty" | "error">("idle");
  const [message, setMessage] = useState("");
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const normalizedQuery = query.trim();
    setNotice("");
    if (!normalizedQuery) {
      setResults([]);
      setMessage("");
      setStatus("idle");
      return;
    }
    if (normalizedQuery.length < 2) {
      setResults([]);
      setMessage("Keep typing — use at least two characters.");
      setStatus("idle");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setStatus("loading");
      setMessage("");
      try {
        const response = await fetch(`/api/tmdb?q=${encodeURIComponent(normalizedQuery)}`, { signal: controller.signal });
        const payload = await response.json() as SearchResponse;
        if (!response.ok) throw new Error(payload.error ?? "Search could not be completed.");
        setResults(payload.results ?? []);
        setStatus(payload.results?.length ? "success" : "empty");
        if (!payload.results?.length) setMessage(`No films matched “${normalizedQuery}”. Try another title.`);
      } catch (error) {
        if (controller.signal.aborted) return;
        setResults([]);
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Search could not be completed.");
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  async function addToJournal(result: SearchResult, watchlist = false) {
    setPendingId(result.id);
    setNotice("");
    try {
      const response = await fetch("/api/movies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId: result.id, watchlist }),
      });
      const payload = await response.json() as { movie?: { id: string; updatedAt: string; watchlist: boolean; favoriteRank: number | null }; message?: string; error?: string };
      if (!response.ok || !payload.movie) throw new Error(payload.error ?? "Could not save this movie.");
      const savedMovie = payload.movie;

      setResults((current) => current.map((movie) => movie.id === result.id ? { ...movie, existing: savedMovie } : movie));
      setNotice(payload.message ?? "Your journal was updated.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save this movie.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-7">
      <div className="surface relative overflow-hidden rounded-3xl p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-emerald-300/10 blur-3xl" />
        <label htmlFor="movie-search" className="eyebrow">Find something worth remembering</label>
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 transition focus-within:border-emerald-300/50 focus-within:shadow-[0_0_0_4px_rgba(119,242,161,.08)]">
          <span className="text-emerald-300" aria-hidden="true">⌕</span>
          <input id="movie-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search films, directors, or fragments of a title" className="w-full bg-transparent text-base text-white outline-none placeholder:text-slate-500" autoComplete="off" />
          {status === "loading" && <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-200/20 border-t-emerald-300" aria-label="Searching" />}
        </div>
        <p className="mt-3 text-sm text-slate-500">Results are sourced from TMDb and checked against your journal in real time.</p>
      </div>

      {notice && <div role="status" className="rounded-2xl border border-emerald-300/25 bg-emerald-300/[0.08] px-4 py-3 text-sm font-medium text-emerald-100">{notice}</div>}
      {status === "idle" && message && <p className="px-1 text-sm text-slate-500">{message}</p>}
      {status === "empty" && <div className="surface-subtle rounded-3xl p-10 text-center"><p className="text-lg font-semibold text-white">Nothing found</p><p className="mt-2 text-sm text-slate-500">{message}</p></div>}
      {status === "error" && <div role="alert" className="rounded-3xl border border-red-300/20 bg-red-300/[0.06] p-6"><p className="font-semibold text-red-100">Search needs a moment</p><p className="mt-1 text-sm text-red-100/70">{message}</p></div>}
      {status === "success" && <div className="space-y-4"><p className="eyebrow px-1">Matches · {results.length} shown</p><div className="grid gap-4">{results.map((result) => {
        const posterUrl = getPosterUrl(result.poster_path);
        const year = result.release_date?.slice(0, 4) ?? "—";
        const alreadyAdded = Boolean(result.existing);
        return <article key={result.id} className="surface group flex gap-4 rounded-3xl p-3.5 sm:gap-6 sm:p-4">
          <div className="h-32 w-[5.4rem] shrink-0 overflow-hidden rounded-xl bg-white/[0.04] sm:h-40 sm:w-28">{posterUrl ? <img src={posterUrl} alt={`${result.title} poster`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center p-2 text-center text-[10px] text-slate-500">No poster</div>}</div>
          <div className="flex min-w-0 flex-1 flex-col py-1">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold tracking-tight text-white sm:text-xl">{result.title}</h2><p className="mt-1 text-xs font-semibold uppercase tracking-[.16em] text-slate-500">{year} · TMDb {result.vote_average ? `★ ${result.vote_average.toFixed(1)}` : "unrated"}{result.popularity ? ` · Popularity ${Math.round(result.popularity)}` : ""}</p></div>{alreadyAdded && <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.13em] text-emerald-200">In journal</span>}</div>
            <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-400">{result.overview || "TMDb has not provided an overview for this film yet."}</p>
            <div className="mt-auto flex flex-wrap gap-2 pt-4"><button type="button" onClick={() => addToJournal(result)} disabled={pendingId === result.id} className={alreadyAdded ? "quiet-button" : "accent-button"}>{pendingId === result.id ? "Saving…" : alreadyAdded ? "Update metadata" : "Add to journal"}</button><button type="button" onClick={() => addToJournal(result, !result.existing?.watchlist)} disabled={pendingId === result.id} className={result.existing?.watchlist ? "quiet-button border-emerald-300/30 text-emerald-100" : "quiet-button"}>{result.existing?.watchlist ? "✓ Watchlisted" : "+ Watchlist"}</button></div>
          </div>
        </article>;
      })}</div></div>}
      {status === "idle" && !message && <div className="surface-subtle rounded-3xl px-6 py-12 text-center"><p className="text-lg font-semibold text-white">Your next discovery starts here.</p><p className="mt-2 text-sm text-slate-500">Search TMDb, preview the essentials, then add only the films you want to keep close.</p></div>}
    </div>
  );
}
