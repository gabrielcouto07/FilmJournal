"use client";

import { useState } from "react";
import ArtworkImage from "@/components/ArtworkImage";
import { useToast } from "@/components/ToastProvider";
import { getPosterUrl } from "@/lib/tmdb";
import { DIMENSION_LABELS, DIMENSION_ORDER, type BlindSpotPick, type GapDimension } from "@/lib/analytics/blindspots";
import type { DiscoverData } from "@/lib/discover";

type Focus = GapDimension | "auto";

const FOCUS_CHIPS: Array<{ id: Focus; label: string }> = [
  { id: "auto", label: "Automático" },
  ...DIMENSION_ORDER.map((dimension) => ({ id: dimension as Focus, label: `${DIMENSION_LABELS[dimension]}s` })),
];

export default function DiscoverExplorer({ initial }: { initial: DiscoverData }) {
  const [data, setData] = useState<DiscoverData>(initial);
  const [focus, setFocus] = useState<Focus>("auto");
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState<Set<number>>(new Set());
  const { notify } = useToast();

  async function load(nextFocus: Focus) {
    setFocus(nextFocus);
    setLoading(true);
    try {
      const query = nextFocus === "auto" ? "" : `?dimension=${nextFocus}`;
      const res = await fetch(`/api/discover${query}`);
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Falha ao buscar sugestões.");
      setData(payload as DiscoverData);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Falha ao buscar sugestões.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function dismiss(dimension: GapDimension, gapKey: string) {
    try {
      const res = await fetch("/api/discover/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dimension, gapKey }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Falha ao registrar.");
      notify(payload.message ?? "Anotado.", "success");
      await load(focus); // re-score without the dismissed bucket
    } catch (error) {
      notify(error instanceof Error ? error.message : "Falha ao registrar.", "error");
    }
  }

  async function addToWatchlist(pick: BlindSpotPick) {
    try {
      const res = await fetch("/api/movies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId: pick.movie.tmdbId, watchlist: true }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Falha ao adicionar.");
      setAdded((previous) => new Set(previous).add(pick.movie.tmdbId));
      notify(`${pick.movie.title} foi para a sua lista.`, "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Falha ao adicionar.", "error");
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {FOCUS_CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            disabled={loading}
            onClick={() => load(chip.id)}
            className={`chip ${focus === chip.id ? "chip-active" : ""}`}
          >
            {chip.label}
          </button>
        ))}
        {focus !== "auto" && (
          <button
            type="button"
            disabled={loading}
            onClick={() => dismiss(focus, "*")}
            className="ml-auto text-xs font-bold text-slate-600 transition hover:text-red-300"
            title="Não sugerir mais esta dimensão"
          >
            Silenciar {DIMENSION_LABELS[focus].toLowerCase()}s ✕
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="surface skeleton-bg h-56 rounded-[1.75rem]" />
          ))}
        </div>
      ) : data.picks.length === 0 ? (
        <div className="empty-state">
          <p className="text-lg font-bold text-white">Nenhuma lacuna por aqui.</p>
          <p className="mt-2 text-sm text-slate-400">
            {data.degraded
              ? "O TMDB está indisponível no momento — tente novamente em instantes."
              : "Seu arquivo cobre bem esta dimensão (ou você silenciou as lacunas restantes)."}
          </p>
        </div>
      ) : (
        <div key={`${focus}-${data.picks.map((pick) => pick.movie.tmdbId).join("-")}`} className="grid gap-4 md:grid-cols-2">
          {data.picks.map((pick, index) => (
            <PickCard
              key={`${pick.dimension}-${pick.gapKey}-${pick.movie.tmdbId}`}
              pick={pick}
              index={index}
              added={added.has(pick.movie.tmdbId)}
              onAdd={() => addToWatchlist(pick)}
              onDismiss={() => dismiss(pick.dimension, pick.gapKey)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PickCard({ pick, index, added, onAdd, onDismiss }: {
  pick: BlindSpotPick;
  index: number;
  added: boolean;
  onAdd: () => void;
  onDismiss: () => void;
}) {
  const poster = getPosterUrl(pick.movie.posterPath);
  return (
    <article className={`surface fade-up fade-up-${Math.min(index + 1, 5)} flex gap-5 overflow-hidden rounded-[1.75rem] p-5 sm:p-6`}>
      <div className="w-28 shrink-0 sm:w-32">
        <div className="artwork-frame aspect-[2/3] rounded-xl">
          <ArtworkImage src={poster} alt={`Pôster de ${pick.movie.title}`} title={pick.movie.title} className="h-full w-full" sizes="128px" />
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip chip-active !px-2.5 !py-1 text-[10px]">{DIMENSION_LABELS[pick.dimension]} · {pick.gapLabel}</span>
          {pick.movie.rating != null && (
            <span className="text-[11px] font-black text-amber-200">★ {pick.movie.rating.toFixed(1)}</span>
          )}
        </div>
        <h3 className="mt-2 truncate text-lg font-black text-white">
          {pick.movie.title}
          {pick.movie.year ? <span className="font-bold text-slate-500"> · {pick.movie.year}</span> : null}
        </h3>
        {/* O motivo da indicação é a parte principal do cartão. */}
        <p className="mt-2 text-sm leading-6 text-slate-300">{pick.rationale}</p>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
          <button type="button" onClick={onAdd} disabled={added} className="accent-button !px-4 !py-2 text-xs disabled:opacity-60">
            {added ? "Na lista ✓" : "+ Para assistir"}
          </button>
          <button type="button" onClick={onDismiss} className="quiet-button !px-4 !py-2 text-xs" title={`Não sugerir mais ${pick.gapLabel}`}>
            Não me interessa
          </button>
        </div>
      </div>
    </article>
  );
}
