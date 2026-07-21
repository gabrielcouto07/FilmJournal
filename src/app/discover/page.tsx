import { getCurrentUser } from "@/lib/auth";
import { getDiscoverPicks } from "@/lib/discover";
import DiscoverExplorer from "@/components/discover/DiscoverExplorer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Descobrir · FilmJournal" };

export default async function DiscoverPage() {
  const viewer = await getCurrentUser();
  const initial = await getDiscoverPicks(viewer?.id ?? "");

  return (
    <main className="page-shell space-y-8">
      <header className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="eyebrow">Descobrir · Pontos cegos</p>
          <h1 className="display-title mt-3 text-5xl sm:text-7xl">Expanda seu mapa.</h1>
          <p className="mt-4 max-w-2xl leading-7 text-slate-400">
            O motor compara seu arquivo com o cinema que existe — por década, país, idioma e gênero —
            e sugere filmes aclamados exatamente onde seu mapa está em branco. Cada sugestão explica
            por que ela apareceu.
          </p>
        </div>
        <p className="self-end text-xs font-bold text-slate-600">{initial.totalFilms} filmes no seu arquivo</p>
      </header>

      <DiscoverExplorer initial={initial} />
    </main>
  );
}
