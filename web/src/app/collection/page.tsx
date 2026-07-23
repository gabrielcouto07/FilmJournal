import CollectionHub from "@/components/CollectionHub";
import { getCurrentUser } from "@/lib/auth";
import { getFavoritesData, getWatchlistData } from "@/lib/data";

export const metadata = { title: "Minha lista · FilmJournal" };

export default async function CollectionPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const viewer = await getCurrentUser();
  const [favorites, watchlist] = await Promise.all([
    getFavoritesData(viewer?.id ?? ""),
    getWatchlistData(viewer?.id ?? ""),
  ]);

  return <CollectionHub favorites={favorites} watchlist={watchlist} initialTab={tab === "assistir" ? "assistir" : "favoritos"} />;
}
