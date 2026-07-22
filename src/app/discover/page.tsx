import { getCurrentUser } from "@/lib/auth";
import { getDiscoverPicks } from "@/lib/discover";
import { getTasteData } from "@/lib/recommendations";
import DiscoverExplorer from "@/components/discover/DiscoverExplorer";
import TasteExplorer from "@/components/TasteExplorer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Descobrir · FilmJournal" };

export default async function DiscoverPage() {
  const viewer = await getCurrentUser();
  const userId = viewer?.id ?? "";
  const [initial, tasteData] = await Promise.all([getDiscoverPicks(userId), getTasteData({ userId })]);

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

      {/* Similarity-based curation (moved from the retired /stats page): the
          blind-spot engine above expands the map; these rails deepen it. */}
      <TasteExplorer initialData={tasteData} />
    </main>
  );
}
