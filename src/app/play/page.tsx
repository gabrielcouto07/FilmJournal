import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PlayHub from "@/components/play/PlayHub";

export const dynamic = "force-dynamic";
export const metadata = { title: "Jogos · FilmJournal" };

export default async function PlayPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const viewer = await getCurrentUser();
  const rows = viewer
    ? await prisma.gameScore.findMany({ where: { userId: viewer.id, game: "hybrid" } })
    : [];
  const bestScores = Object.fromEntries(rows.map((row) => [row.source, row.bestScore])) as Partial<Record<"mine" | "popular" | "daily", number>>;

  return <PlayHub initialBest={bestScores} initialTab={tab === "roleta" ? "roleta" : "jogo"} />;
}
