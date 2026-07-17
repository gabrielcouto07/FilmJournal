"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getPosterUrl } from "@/lib/tmdb";
import ArtworkImage from "./ArtworkImage";
import { useToast } from "./ToastProvider";
import { useAuth } from "./AuthProvider";

type ExistingMovie = { id: string; updatedAt: string; watchlist: boolean; favorite: boolean; favoriteRank: number | null } | null;
type SearchResult = { id: number; title: string; release_date?: string; poster_path?: string | null; backdrop_path?: string | null; overview?: string; vote_average?: number; popularity?: number; existing: ExistingMovie };
type SearchResponse = { results: SearchResult[]; total_results: number; error?: string };
type Feed = "trending" | "popular" | "now-playing" | "top-rated" | "upcoming";
const feeds: Array<{ id: Feed; label: string }> = [{id:"trending",label:"Em alta"},{id:"popular",label:"Populares"},{id:"now-playing",label:"Em cartaz"},{id:"top-rated",label:"Mais bem avaliados"},{id:"upcoming",label:"Em breve"}];

export default function MovieSearch() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("query") ?? "");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<"idle"|"loading"|"success"|"empty"|"error">("idle");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [activeFeed, setActiveFeed] = useState<Feed>("trending");
  const [feedCache, setFeedCache] = useState<Partial<Record<Feed, SearchResult[]>>>({});
  const [feedLoading, setFeedLoading] = useState(false);
  const { notify } = useToast();

  useEffect(() => {
    const normalized = query.trim();
    if (!normalized) { setResults([]); setMessage(""); setStatus("idle"); return; }
    if (normalized.length < 2) { setResults([]); setMessage("Continue digitando — use pelo menos dois caracteres."); setStatus("idle"); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setStatus("loading"); setMessage("");
      try {
        const response = await fetch(`/api/tmdb?q=${encodeURIComponent(normalized)}`, { signal: controller.signal });
        const payload = await response.json() as SearchResponse;
        if (!response.ok) throw new Error(payload.error ?? "Não foi possível concluir a busca.");
        setResults(payload.results ?? []); setStatus(payload.results?.length ? "success" : "empty");
        if (!payload.results?.length) setMessage(`Nenhum filme corresponde a “${normalized}”.`);
      } catch (error) { if (!controller.signal.aborted) { setResults([]); setStatus("error"); setMessage(error instanceof Error ? error.message : "A busca falhou."); } }
    }, 320);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query]);

  useEffect(() => {
    if (query.trim() || feedCache[activeFeed]) return;
    const controller = new AbortController(); setFeedLoading(true);
    fetch(`/api/tmdb?feed=${activeFeed}`, { signal: controller.signal }).then(async (response) => {
      const payload = await response.json() as SearchResponse;
      if (!response.ok) throw new Error(payload.error);
      setFeedCache((cache) => ({ ...cache, [activeFeed]: payload.results ?? [] }));
    }).catch((error) => { if (!controller.signal.aborted) notify(error instanceof Error ? error.message : "Não foi possível carregar a seleção.", "error"); }).finally(() => { if (!controller.signal.aborted) setFeedLoading(false); });
    return () => controller.abort();
  }, [activeFeed, feedCache, notify, query]);

  async function act(result: SearchResult, action: "add"|"watchlist"|"favorite"|"log") {
    const token = `${result.id}:${action}`; setPending(token);
    try {
      const addResponse = await fetch("/api/movies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tmdbId: result.id, ...(action === "watchlist" ? { watchlist: !result.existing?.watchlist } : {}) }) });
      const addPayload = await addResponse.json() as { movie?: ExistingMovie & { title?: string }; message?: string; error?: string };
      if (!addResponse.ok || !addPayload.movie) throw new Error(addPayload.error ?? "Não foi possível salvar este filme.");
      let saved = addPayload.movie;
      let notice = addPayload.message ?? "Filme salvo.";
      if (action === "favorite") {
        const response = await fetch("/api/movies", { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({movieId:saved.id,action:"favorite",value:!result.existing?.favorite}) });
        const payload = await response.json() as { movie?: typeof saved; message?: string; error?: string };
        if (!response.ok || !payload.movie) throw new Error(payload.error ?? "Não foi possível atualizar os favoritos."); saved = payload.movie; notice = payload.message ?? notice;
      }
      if (action === "log") {
        const response = await fetch("/api/logs", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({movieId:saved.id}) });
        const payload = await response.json() as { message?: string; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Não foi possível registrar este filme."); notice = payload.message ?? notice; saved = { ...saved, watchlist: false };
      }
      const replace = (items: SearchResult[]) => items.map((item) => item.id === result.id ? { ...item, existing: saved } : item);
      setResults(replace); setFeedCache((cache) => Object.fromEntries(Object.entries(cache).map(([key,value]) => [key, replace(value ?? [])])) as Partial<Record<Feed, SearchResult[]>>);
      notify(notice);
    } catch (error) { notify(error instanceof Error ? error.message : "Não foi possível atualizar este filme.", "error"); }
    finally { setPending(null); }
  }

  const feedResults = feedCache[activeFeed] ?? [];
  return <div className="space-y-8">
    <section className="surface relative overflow-hidden rounded-[1.75rem] p-5 sm:p-8"><div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-amber-300/10 blur-3xl" /><label htmlFor="movie-search" className="eyebrow">Busque o cinema mundial</label><div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-4 transition focus-within:border-amber-300/50 focus-within:ring-4 focus-within:ring-amber-300/[0.07]"><span className="text-xl text-amber-300">⌕</span><input id="movie-search" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por título do filme…" className="min-w-0 flex-1 bg-transparent text-lg font-bold text-white outline-none placeholder:font-medium placeholder:text-slate-600" autoComplete="off" />{status === "loading" && <span className="h-5 w-5 animate-spin rounded-full border-2 border-amber-200/20 border-t-amber-300" aria-label="Buscando" />}</div><p className="mt-3 text-xs text-slate-500">Busca TMDb com debounce · requisições obsoletas são canceladas · resultados são verificados no seu arquivo.</p></section>

    {query.trim() ? <section>{status === "idle" && message && <p className="text-sm text-slate-500">{message}</p>}{status === "empty" && <div className="empty-state"><p className="font-bold text-white">Nada encontrado</p><p className="mt-2 text-sm text-slate-500">{message}</p></div>}{status === "error" && <div className="rounded-2xl border border-red-300/20 bg-red-300/[0.06] p-5 text-red-100" role="alert">{message}</div>}{status === "loading" && <CardSkeletons />}{status === "success" && <><div className="mb-4 flex items-end justify-between"><div><p className="eyebrow">Resultados da busca</p><h2 className="section-heading mt-2">{results.length} correspondências mais próximas.</h2></div></div><div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">{results.map((result) => <ResultCard key={result.id} result={result} pending={pending} act={act} />)}</div></>}</section> : <section><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Ao vivo do TMDb</p><h2 className="section-heading mt-2">Continue explorando.</h2></div><div className="rail flex max-w-full gap-1 overflow-x-auto rounded-full border border-white/[0.08] bg-white/[0.02] p-1">{feeds.map((feed) => <button type="button" key={feed.id} onClick={() => setActiveFeed(feed.id)} className={`shrink-0 rounded-full px-3 py-2 text-xs font-bold transition ${activeFeed === feed.id ? "bg-amber-300 text-black" : "text-slate-500 hover:text-white"}`}>{feed.label}</button>)}</div></div>{feedLoading ? <CardSkeletons /> : <div className="rail -mx-1 mt-5 flex gap-3 overflow-x-auto px-1 pb-5">{feedResults.map((result) => <div key={result.id} className="w-48 shrink-0 sm:w-56"><ResultCard result={result} pending={pending} act={act} /></div>)}</div>}</section>}
  </div>;
}

function CardSkeletons() { return <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">{Array.from({length:8},(_,index)=><div key={index} className="shimmer aspect-[2/3.8] rounded-[1.2rem]" />)}</div>; }

function ResultCard({ result, pending, act }: { result: SearchResult; pending: string | null; act: (result: SearchResult, action: "add"|"watchlist"|"favorite"|"log") => void }) {
  const poster = getPosterUrl(result.poster_path);
  const busy = pending?.startsWith(`${result.id}:`) ?? false;
  const { user } = useAuth();

  return <article className="poster-card group overflow-hidden rounded-[1.2rem] border border-white/[0.09] bg-[#141414]"><div className="relative aspect-[2/3] bg-white/[0.04]"><ArtworkImage src={poster} alt={`Pôster de ${result.title}`} title={result.title} className="h-full w-full" sizes="(max-width: 768px) 45vw, 280px" /><div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black via-black/60 p-3 pt-16"><h3 className="line-clamp-2 text-sm font-black text-white">{result.title}</h3><p className="mt-1 text-[10px] font-bold text-slate-400">{result.release_date?.slice(0,4) ?? "—"} · {result.vote_average ? `★ ${result.vote_average.toFixed(1)}` : "Sem nota"}</p></div>{result.existing && <span className="absolute left-2.5 top-2.5 z-10 rounded-full bg-amber-300 px-2 py-1 text-[9px] font-black uppercase text-black">No arquivo</span>}</div><div className="p-2">
    {user ? (
      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" disabled={busy} onClick={() => act(result,"watchlist")} className="quiet-button !px-2 !py-2 text-[10px]">{result.existing?.watchlist ? "✓ Salvo" : "+ Lista"}</button>
        <button type="button" disabled={busy} onClick={() => act(result,"log")} className="accent-button !px-2 !py-2 text-[10px]">{pending === `${result.id}:log` ? "Registrando…" : "Registrar agora"}</button>
        <button type="button" disabled={busy} onClick={() => act(result,"favorite")} className="quiet-button !px-2 !py-2 text-[10px]">{result.existing?.favorite ? "♥ Favorito" : "♡ Favorito"}</button>
        {result.existing ? <Link href={`/film/${result.existing.id}`} className="quiet-button !px-2 !py-2 text-[10px]">Abrir</Link> : <button type="button" disabled={busy} onClick={() => act(result,"add")} className="quiet-button !px-2 !py-2 text-[10px]">Adicionar</button>}
      </div>
    ) : (
      <div className="flex justify-center w-full">
        {result.existing ? (
          <Link href={`/film/${result.existing.id}`} className="accent-button text-center w-full !py-2 text-[10px]">Abrir detalhes do filme</Link>
        ) : (
          <span className="text-xs font-semibold text-slate-600 py-1.5">Fora do arquivo</span>
        )}
      </div>
    )}
  </div></article>;
}
