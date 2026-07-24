import PlayHub from "@/components/play/PlayHub";
import { apiGet } from "@/lib/api-server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Jogos · FilmJournal" };

type Source = "mine" | "popular" | "daily";
type ScoresResponse = { scores: Partial<Record<Source, { bestScore: number; bestRounds: number }>> };

export default async function PlayPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const { scores } = await apiGet<ScoresResponse>("/play/score");
  const bestScores = Object.fromEntries(
    Object.entries(scores).map(([source, value]) => [source, value.bestScore]),
  ) as Partial<Record<Source, number>>;

  return <PlayHub initialBest={bestScores} initialTab={tab === "roleta" ? "roleta" : "jogo"} />;
}
