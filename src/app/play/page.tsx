import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import HybridGame from "@/components/play/HybridGame";

export const dynamic = "force-dynamic";
export const metadata = { title: "Jogar · FilmJournal" };

export default async function PlayPage() {
  const viewer = await getCurrentUser();
  const rows = viewer
    ? await prisma.gameScore.findMany({ where: { userId: viewer.id, game: "hybrid" } })
    : [];
  const bestScores = Object.fromEntries(rows.map((row) => [row.source, row.bestScore])) as Partial<Record<"mine" | "popular" | "daily", number>>;

  return (
    <main className="page-shell max-w-6xl space-y-10">
      <header>
        <p className="eyebrow">Jogar · Cine-Detetive</p>
        <h1 className="display-title mt-3 text-5xl sm:text-7xl">Descubra o filme.</h1>
        <p className="mt-4 max-w-2xl leading-7 text-slate-400">
          Dez palpites para desmascarar o filme misterioso. O elenco aparece nome a nome, o pôster
          emerge do desfoque — e cada chute compara ano, gêneros, direção, estúdio, nota e elenco
          com o alvo. Menos palpites, mais pontos.
        </p>
      </header>

      <HybridGame initialBest={bestScores} />
    </main>
  );
}
