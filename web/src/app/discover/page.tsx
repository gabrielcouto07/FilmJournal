import { apiGet } from "@/lib/api-server";
import type { DiscoverData } from "@/lib/discover";
import type { TasteData } from "@/lib/recommendations";
import DiscoverExplorer from "@/components/discover/DiscoverExplorer";
import TasteExplorer from "@/components/TasteExplorer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Descobrir · FilmJournal" };

export default async function DiscoverPage() {
  const [initial, tasteData] = await Promise.all([
    apiGet<DiscoverData>("/discover"),
    apiGet<TasteData>("/recommendations"),
  ]);

  return (
    <main className="page-shell space-y-8">
      <header className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="eyebrow">Descobrir · Pontos cegos</p>
          <h1 className="display-title mt-3 text-5xl sm:text-7xl">Expanda seu mapa.</h1>
          <p className="mt-4 max-w-2xl leading-7 text-slate-400">
            Comparamos seu acervo com o cinema mundial — por década, país, idioma e gênero — e
            sugerimos filmes aclamados exatamente onde o seu mapa ainda está em branco. Cada
            sugestão explica por que apareceu.
          </p>
        </div>
        <p className="self-end text-xs font-bold text-slate-600">{initial.totalFilms} filmes no seu acervo</p>
      </header>

      <DiscoverExplorer initial={initial} />

      {/* A seleção abaixo aprofunda as indicações dos pontos cegos. */}
      <TasteExplorer initialData={tasteData} />
    </main>
  );
}
