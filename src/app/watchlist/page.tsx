import WatchlistExplorer from "@/components/WatchlistExplorer";
import { getCurrentUser } from "@/lib/auth";
import { getWatchlistData } from "@/lib/data";

export default async function WatchlistPage() {
  const viewer = await getCurrentUser();
  const movies = await getWatchlistData(viewer?.id ?? "");
  const runtime = movies.reduce((total, movie) => total + (movie.runtime ?? 0), 0);

  return <main className="page-shell"><header className="mb-8 grid gap-6 lg:grid-cols-[1fr_auto]"><div><p className="eyebrow">A fila para a próxima noite</p><h1 className="display-title mt-3 text-5xl sm:text-7xl">Watchlist.</h1><p className="mt-4 max-w-2xl leading-7 text-slate-400">Ordene as possibilidades, remova-as instantaneamente ou transforme qualquer filme salvo em uma entrada real no diário.</p></div><div className="surface-subtle self-end rounded-2xl px-5 py-4 text-right"><p className="eyebrow !text-slate-600">Tamanho da fila</p><p className="mt-1 text-4xl font-black text-amber-200">{movies.length}</p><p className="text-xs text-slate-500">{runtime ? `${Math.round(runtime/60)} horas de cinema` : "Duração pendente"}</p></div></header><WatchlistExplorer initialMovies={movies} /></main>;
}
