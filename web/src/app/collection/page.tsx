import CollectionHub from "@/components/CollectionHub";
import { apiGet } from "@/lib/api-server";
import type { FavoriteMovie } from "@/components/FavoritesManager";
import type { WatchlistMovie } from "@/components/WatchlistExplorer";

export const metadata = { title: "Minha lista · FilmJournal" };

export default async function CollectionPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const [favorites, watchlist] = await Promise.all([
    apiGet<FavoriteMovie[]>("/favorites"),
    apiGet<WatchlistMovie[]>("/watchlist"),
  ]);

  return <CollectionHub favorites={favorites} watchlist={watchlist} initialTab={tab === "assistir" ? "assistir" : "favoritos"} />;
}
