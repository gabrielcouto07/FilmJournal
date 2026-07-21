"use client";

import { useState } from "react";
import { useToast } from "./ToastProvider";
import { useAuth } from "./AuthProvider";

type Props = { movieId: string; initialWatchlist: boolean; initialFavorite: boolean; initialFavoriteRank: number | null; compact?: boolean };
type Action = "watchlist" | "favorite" | "top10";
type MovieResponse = { movie?: { watchlist: boolean; favorite: boolean; favoriteRank: number | null }; message?: string; error?: string };

export default function CollectionControls({ movieId, initialWatchlist, initialFavorite, initialFavoriteRank, compact = false }: Props) {
  const [watchlist, setWatchlist] = useState(initialWatchlist);
  const [favorite, setFavorite] = useState(initialFavorite);
  const [favoriteRank, setFavoriteRank] = useState(initialFavoriteRank);
  const [pending, setPending] = useState<Action | null>(null);
  const { notify } = useToast();
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  async function update(action: Action, value: boolean) {
    const previous = { watchlist, favorite, favoriteRank };
    if (action === "watchlist") setWatchlist(value);
    if (action === "favorite") setFavorite(value);
    if (action === "top10" && !value) setFavoriteRank(null);
    setPending(action);
    try {
      const response = await fetch("/api/movies", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ movieId, action, value }) });
      const payload = await response.json() as MovieResponse;
      if (!response.ok || !payload.movie) throw new Error(payload.error ?? "Não foi possível atualizar este filme.");
      setWatchlist(payload.movie.watchlist);
      setFavorite(payload.movie.favorite);
      setFavoriteRank(payload.movie.favoriteRank);
      notify(payload.message ?? "Filme atualizado.");
    } catch (error) {
      setWatchlist(previous.watchlist); setFavorite(previous.favorite); setFavoriteRank(previous.favoriteRank);
      notify(error instanceof Error ? error.message : "Não foi possível atualizar este filme.", "error");
    } finally { setPending(null); }
  }

  return <div className={`flex flex-wrap gap-2 ${compact ? "" : "sm:gap-3"}`}>
    <button type="button" onClick={() => update("watchlist", !watchlist)} disabled={pending !== null} className={watchlist ? "accent-button" : "quiet-button"}>{pending === "watchlist" ? "Salvando…" : watchlist ? "✓ Para assistir" : "＋ Para assistir"}</button>
    <button type="button" onClick={() => update("favorite", !favorite)} disabled={pending !== null} className={favorite ? "quiet-button border-amber-300/35 text-amber-100" : "quiet-button"}>{pending === "favorite" ? "Salvando…" : favorite ? "♥ Favorito" : "♡ Favorito"}</button>
    {!compact && <button type="button" onClick={() => update("top10", favoriteRank == null)} disabled={pending !== null} className={favoriteRank != null ? "quiet-button border-amber-300/30 text-amber-100" : "quiet-button"}>{pending === "top10" ? "Salvando…" : favoriteRank != null ? `Top 10 · #${favoriteRank}` : "+ Top 10"}</button>}
  </div>;
}
