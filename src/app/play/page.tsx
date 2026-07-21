import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CastQuizGame from "@/components/play/CastQuizGame";

export const dynamic = "force-dynamic";
export const metadata = { title: "Jogar · FilmJournal" };

export default async function PlayPage() {
  const viewer = await getCurrentUser();
  const rows = viewer
    ? await prisma.gameScore.findMany({ where: { userId: viewer.id, game: "cast" } })
    : [];
  const bestScores = Object.fromEntries(rows.map((row) => [row.source, row.bestScore])) as Partial<Record<"mine" | "popular", number>>;

  return (
    <main className="page-shell max-w-5xl space-y-10">
      <header>
        <p className="eyebrow">Jogar · Quem está no elenco?</p>
        <h1 className="display-title mt-3 text-5xl sm:text-7xl">Adivinhe pelo elenco.</h1>
        <p className="mt-4 max-w-2xl leading-7 text-slate-400">
          Um filme, um elenco revelado nome a nome. Quanto menos atores você precisar — e mais rápido
          responder —, mais pontos. Cinco rodadas por partida.
        </p>
      </header>

      <CastQuizGame initialBest={bestScores} />
    </main>
  );
}
