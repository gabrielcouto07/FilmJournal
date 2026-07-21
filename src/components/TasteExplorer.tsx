"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { TasteData, TasteRecommendation } from "@/lib/recommendations";
import { getPosterUrl } from "@/lib/tmdb";
import ArtworkImage from "./ArtworkImage";
import { useToast } from "./ToastProvider";

type RecommendationAction = "open" | "watchlist" | "log";

export default function TasteExplorer({ initialData }: { initialData: TasteData }) {
  const [data, setData] = useState(initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const { notify } = useToast();
  const router = useRouter();

  function updateExisting(tmdbId: number, existing: TasteRecommendation["existing"]) {
    const update = (movie: TasteRecommendation) => movie.tmdbId === tmdbId ? { ...movie, existing } : movie;
    setData((current) => ({
      ...current,
      becauseYouLoved: current.becauseYouLoved.map(update),
      genreDiscovery: current.genreDiscovery.map(update),
      directors: current.directors.map((director) => ({ ...director, films: director.films.map(update) })),
    }));
  }

  function removeWatched(tmdbId: number) {
    const keep = (movie: TasteRecommendation) => movie.tmdbId !== tmdbId;
    setData((current) => ({
      ...current,
      becauseYouLoved: current.becauseYouLoved.filter(keep),
      genreDiscovery: current.genreDiscovery.filter(keep),
      directors: current.directors.map((director) => ({ ...director, films: director.films.filter(keep) })),
    }));
  }

  async function act(movie: TasteRecommendation, action: RecommendationAction) {
    const token = `${movie.tmdbId}:${action}`;
    setPending(token);
    try {
      if (action === "open" && movie.existing) { router.push(`/film/${movie.existing.id}`); return; }
      let existing = movie.existing;
      let notice = "Filme atualizado.";
      if (!existing) {
        const addResponse = await fetch("/api/movies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tmdbId: movie.tmdbId, ...(action === "watchlist" ? { watchlist: true } : {}) }),
        });
        const addPayload = await addResponse.json() as { movie?: { id: string; watchlist: boolean; favorite: boolean }; message?: string; error?: string };
        if (!addResponse.ok || !addPayload.movie) throw new Error(addPayload.error ?? "Não foi possível salvar este filme.");
        existing = { id: addPayload.movie.id, watchlist: addPayload.movie.watchlist, favorite: addPayload.movie.favorite };
        notice = addPayload.message ?? notice;
        updateExisting(movie.tmdbId, existing);
      } else if (action === "watchlist" && !existing.watchlist) {
        const response = await fetch("/api/movies", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ movieId: existing.id, action: "watchlist", value: true }) });
        const payload = await response.json() as { movie?: { id: string; watchlist: boolean; favorite: boolean }; message?: string; error?: string };
        if (!response.ok || !payload.movie) throw new Error(payload.error ?? "Não foi possível atualizar sua lista para assistir.");
        existing = { id: payload.movie.id, watchlist: payload.movie.watchlist, favorite: payload.movie.favorite };
        notice = payload.message ?? notice;
        updateExisting(movie.tmdbId, existing);
      }

      if (action === "log") {
        const response = await fetch("/api/logs", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ movieId: existing.id }),
        });
        const payload = await response.json() as { message?: string; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Não foi possível registrar este filme.");
        removeWatched(movie.tmdbId);
        notify(payload.message ?? `${movie.title} registrado.`);
      } else if (action === "open") {
        router.push(`/film/${existing.id}`);
      } else {
        notify(notice === "Filme atualizado." ? `${movie.title} adicionado à sua lista para assistir.` : notice);
      }
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : "Não foi possível atualizar este filme.", "error");
    } finally { setPending(null); }
  }

  async function refresh() {
    setRefreshing(true); setError("");
    try {
      const response = await fetch("/api/recommendations?refresh=1", { cache: "no-store" });
      const payload = await response.json() as TasteData & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível atualizar sua curadoria.");
      setData(payload); notify("Sua curadoria de próximos filmes foi atualizada.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível atualizar sua curadoria.");
    } finally { setRefreshing(false); }
  }

  return <section id="taste" className="scroll-mt-28 space-y-12">
    <header className="surface relative overflow-hidden rounded-[2rem] p-6 sm:p-8">
      <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-amber-300/[0.09] blur-3xl" />
      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-3xl"><p className="eyebrow">Feito a partir do seu acervo</p><h2 className="display-title balance mt-3 text-4xl sm:text-6xl">Seu DNA cinematográfico.</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">Recomendações moldadas pelas suas notas, favoritos, diretores, gêneros e histórico real de exibições—não uma prateleira genérica de tendências.</p></div>
        <button type="button" onClick={refresh} disabled={refreshing} className="quiet-button min-w-40">{refreshing ? "Curando…" : "Atualizar curadoria"}</button>
      </div>
      <div className="relative mt-7 flex flex-wrap gap-2">
        {data.profile.topGenres.slice(0, 4).map((genre) => <span key={genre.name} className="chip"><span className="mr-1.5 text-amber-200">{genre.name}</span>{genre.count} filmes{genre.averageRating != null ? ` · ${genre.averageRating.toFixed(1)} de média` : ""}</span>)}
        {data.profile.favoriteDecade && <span className="chip">Era mais revisitada <span className="ml-1.5 text-white">{data.profile.favoriteDecade}</span></span>}
      </div>
      <p className="relative mt-4 text-[10px] font-bold uppercase tracking-wider text-slate-600">{data.profile.watchedFilms} filmes assistidos analisados · curadoria do TMDb em cache por {data.cacheTtlHours} horas</p>
      {error && <p role="alert" className="relative mt-5 rounded-xl border border-red-300/20 bg-red-300/[0.06] p-3 text-sm text-red-100">{error}</p>}
    </header>

    {refreshing ? <TasteSkeleton /> : <>
      <TasteRail eyebrow="Das suas melhores notas" title="Porque você avaliou estes com nota alta." description="Os sinais de similaridade começam com filmes que você avaliou com 4,0 ou mais e depois removem tudo o que você já assistiu." movies={data.becauseYouLoved} pending={pending} act={act} />

      <section><SectionHeading eyebrow="As vozes às quais você retorna" title="Mais dos seus diretores favoritos." />
        <div className="mt-5 space-y-4">{data.directors.length ? data.directors.map((director) => <article key={director.name} className="surface overflow-hidden rounded-[1.75rem] p-5 sm:p-7"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-2xl font-black tracking-tight text-white">{director.name}</p><p className="mt-1 text-xs leading-5 text-slate-500">{director.reason}</p></div><div className="flex gap-2"><span className="chip">{director.watchedCount} assistidos</span>{director.averageRating != null && <span className="chip"><span className="text-amber-200">★ {director.averageRating.toFixed(2)}</span> de média</span>}</div></div>{director.films.length ? <div className="rail -mx-1 mt-5 flex gap-3 overflow-x-auto px-1 pb-4">{director.films.map((movie) => <div key={movie.tmdbId} className="w-44 shrink-0 sm:w-48"><TastePosterCard movie={movie} pending={pending} act={act} compact /></div>)}</div> : <EmptyState text={`O TMDb não retornou filmes elegíveis de ${director.name} ainda não assistidos.`} />}</article>) : <EmptyState text="Avalie mais filmes com créditos de direção para desbloquear esta prateleira." />}</div>
      </section>

      <TasteRail eyebrow="Descoberta de gêneros" title={`Siga sua trilha de ${data.genreDiscoveryLabel}.`} description="Filmes aclamados e ainda não assistidos, conectados ao seu padrão de gênero mais forte." movies={data.genreDiscovery} pending={pending} act={act} />

      <section><SectionHeading eyebrow="Um ponto cego silencioso" title="Histórias ainda não escritas." description="Filmes que você amou mas nunca avaliou—um pequeno convite para concluir a memória." />
        {data.blindSpots.length ? <div className="rail -mx-1 mt-5 flex gap-3 overflow-x-auto px-1 pb-5">{data.blindSpots.map((movie) => <Link href={`/film/${movie.id}`} key={movie.id} className="poster-card group w-36 shrink-0 overflow-hidden rounded-[1rem] border border-white/[0.09] bg-[#141414] sm:w-40"><ArtworkImage src={getPosterUrl(movie.preferredPosterPath)} fallbackSrc={getPosterUrl(movie.posterPath)} alt={`Pôster de ${movie.title}`} title={movie.title} className="aspect-[2/3] w-full" sizes="160px" /><div className="p-3"><p className="truncate text-xs font-black text-white">{movie.title}</p><p className="mt-1 text-[10px] font-bold text-amber-200">★ {movie.rating.toFixed(1)} · Adicione sua nota →</p></div></Link>)}</div> : <EmptyState text="Todo filme bem avaliado já tem uma memória escrita. Muito bem, tudo completo." />}
      </section>
    </>}
  </section>;
}

function TasteRail({ eyebrow, title, description, movies, pending, act }: { eyebrow: string; title: string; description: string; movies: TasteRecommendation[]; pending: string | null; act: (movie: TasteRecommendation, action: RecommendationAction) => void }) {
  return <section><SectionHeading eyebrow={eyebrow} title={title} description={description} />{movies.length ? <div className="rail -mx-1 mt-5 flex gap-3 overflow-x-auto px-1 pb-6">{movies.map((movie) => <div key={movie.tmdbId} className="w-48 shrink-0 sm:w-52"><TastePosterCard movie={movie} pending={pending} act={act} /></div>)}</div> : <EmptyState text="Não há recomendações elegíveis ainda não assistidas nesta rodada. Atualize mais tarde conforme seu acervo cresce." />}</section>;
}

function TastePosterCard({ movie, pending, act, compact = false }: { movie: TasteRecommendation; pending: string | null; act: (movie: TasteRecommendation, action: RecommendationAction) => void; compact?: boolean }) {
  const busy = pending?.startsWith(`${movie.tmdbId}:`) ?? false;
  return <article className="poster-card group overflow-hidden rounded-[1.15rem] border border-white/[0.09] bg-[#141414]"><button type="button" disabled={busy} onClick={() => act(movie, "open")} className="block w-full text-left"><div className="relative aspect-[2/3]"><ArtworkImage src={getPosterUrl(movie.preferredPosterPath)} fallbackSrc={getPosterUrl(movie.posterPath)} alt={`Pôster de ${movie.title}`} title={movie.title} className="h-full w-full" sizes={compact ? "192px" : "208px"} /><div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black via-black/50 p-3 pt-16"><p className="line-clamp-2 text-sm font-black text-white">{movie.title}</p><p className="mt-1 text-[10px] font-bold text-slate-400">{movie.year ?? "Ano desconhecido"}{movie.tmdbRating ? ` · TMDb ${movie.tmdbRating.toFixed(1)}` : ""}</p></div></div></button><div className="border-t border-white/[0.06] p-2.5"><p className="line-clamp-2 min-h-8 text-[10px] font-semibold leading-4 text-amber-100/70">{movie.reason}</p><div className="mt-2 grid grid-cols-2 gap-1.5"><button type="button" disabled={busy || Boolean(movie.existing?.watchlist)} onClick={() => act(movie, "watchlist")} className="quiet-button !px-2 !py-2 text-[10px]">{movie.existing?.watchlist ? "✓ Para assistir" : "＋ Para assistir"}</button><button type="button" disabled={busy} onClick={() => act(movie, "log")} className="accent-button !px-2 !py-2 text-[10px]">{pending === `${movie.tmdbId}:log` ? "Registrando…" : "Registrar exibição"}</button></div></div></article>;
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) { return <div><p className="eyebrow">{eyebrow}</p><h3 className="section-heading mt-2">{title}</h3>{description && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>}</div>; }
function EmptyState({ text }: { text: string }) { return <div className="empty-state mt-5 !py-8"><p className="text-sm text-slate-500">{text}</p></div>; }
function TasteSkeleton() { return <div className="space-y-10" aria-label="Atualizando recomendações"><div><div className="shimmer h-8 w-72 rounded-lg"/><div className="mt-5 flex gap-3 overflow-hidden">{Array.from({length:6},(_,index)=><div key={index} className="shimmer aspect-[2/3] w-48 shrink-0 rounded-[1.15rem]"/>)}</div></div><div className="shimmer h-72 rounded-[1.75rem]"/></div>; }
