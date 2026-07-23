"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FavoritesManager, { type FavoriteMovie } from "@/components/FavoritesManager";
import WatchlistExplorer, { type WatchlistMovie } from "@/components/WatchlistExplorer";

type CollectionTab = "favoritos" | "assistir";

const TABS: Array<{ id: CollectionTab; label: string }> = [
  { id: "favoritos", label: "★ Favoritos" },
  { id: "assistir", label: "▸ Para assistir" },
];

// Reúne favoritos e a fila para assistir em uma única página com abas.
export default function CollectionHub({
  favorites,
  watchlist,
  initialTab = "favoritos",
}: {
  favorites: FavoriteMovie[];
  watchlist: WatchlistMovie[];
  initialTab?: CollectionTab;
}) {
  const [tab, setTab] = useState<CollectionTab>(initialTab);
  const router = useRouter();

  const select = (next: CollectionTab) => {
    setTab(next);
    router.replace(next === "favoritos" ? "/collection" : `/collection?tab=${next}`, { scroll: false });
  };

  const ranked = favorites.filter((movie) => movie.favoriteRank != null).length;
  const queueRuntime = watchlist.reduce((total, movie) => total + (movie.runtime ?? 0), 0);

  return (
    <main className="page-shell max-w-6xl space-y-8">
      <nav className="flex flex-wrap gap-1 rounded-full border border-white/[0.07] bg-white/[0.025] p-1" aria-label="Seções da lista">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => select(item.id)}
            aria-current={tab === item.id}
            className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-wider transition ${tab === item.id ? "bg-amber-300 text-[#1a1400]" : "text-slate-400 hover:text-white"}`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "favoritos" ? (
        <div className="space-y-8">
          <header className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="eyebrow">Cânone pessoal</p>
              <h2 className="display-title mt-2 text-4xl sm:text-5xl">O Top 10.</h2>
              <p className="mt-4 max-w-2xl leading-7 text-slate-400">Um ranking permanente para os filmes essenciais, com uma coleção de favoritos mais ampla ao redor dele. Mova os títulos com os controles acessíveis.</p>
            </div>
            <div className="rounded-full border border-amber-300/20 bg-amber-300/[0.06] px-5 py-2.5 text-sm font-black text-amber-100">{ranked} / 10 classificados</div>
          </header>
          <FavoritesManager initialMovies={favorites} />
        </div>
      ) : (
        <div className="space-y-8">
          <header className="grid gap-6 lg:grid-cols-[1fr_auto]">
            <div>
              <p className="eyebrow">A fila para a próxima noite</p>
              <h2 className="display-title mt-2 text-4xl sm:text-5xl">Para assistir.</h2>
              <p className="mt-4 max-w-2xl leading-7 text-slate-400">Ordene as possibilidades, remova-as instantaneamente ou transforme qualquer filme salvo em uma entrada real no diário.</p>
            </div>
            <div className="surface-subtle self-end rounded-2xl px-5 py-4 text-right">
              <p className="eyebrow !text-slate-600">Tamanho da fila</p>
              <p className="mt-1 text-4xl font-black text-amber-200">{watchlist.length}</p>
              <p className="text-xs text-slate-500">{queueRuntime ? `${Math.round(queueRuntime / 60)} horas de cinema` : "Duração pendente"}</p>
            </div>
          </header>
          <WatchlistExplorer initialMovies={watchlist} />
        </div>
      )}
    </main>
  );
}
