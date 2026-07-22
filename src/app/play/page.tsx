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
          Você tem dez palpites para descobrir o filme secreto. O elenco aparece nome a nome, o
          pôster vai ganhando nitidez — e cada palpite mostra, em cores, o que bateu, o que chegou
          perto e o que passou longe: ano, gêneros, direção, estúdio, nota e elenco. Quanto menos
          palpites, mais pontos.
        </p>
      </header>

      <HybridGame initialBest={bestScores} />
    </main>
  );
}
