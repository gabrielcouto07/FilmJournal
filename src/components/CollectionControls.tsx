"use client";

import { useState } from "react";

type CollectionControlsProps = {
  movieId: string;
  initialWatchlist: boolean;
  initialFavoriteRank: number | null;
  compact?: boolean;
};

type MovieResponse = { movie?: { watchlist: boolean; favoriteRank: number | null }; message?: string; error?: string };

export default function CollectionControls({ movieId, initialWatchlist, initialFavoriteRank, compact = false }: CollectionControlsProps) {
  const [watchlist, setWatchlist] = useState(initialWatchlist);
  const [favoriteRank, setFavoriteRank] = useState(initialFavoriteRank);
  const [pending, setPending] = useState<"watchlist" | "favorite" | null>(null);
  const [notice, setNotice] = useState("");

  async function updateCollection(action: "watchlist" | "favorite", value: boolean) {
    setPending(action);
    setNotice("");
    try {
      const response = await fetch("/api/movies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movieId, action, value }),
      });
      const payload = await response.json() as MovieResponse;
      if (!response.ok || !payload.movie) throw new Error(payload.error ?? "Could not update this collection.");
      setWatchlist(payload.movie.watchlist);
      setFavoriteRank(payload.movie.favoriteRank);
      setNotice(payload.message ?? "Collection updated.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not update this collection.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className={`flex flex-wrap gap-2 ${compact ? "" : "sm:gap-3"}`}>
        <button type="button" onClick={() => updateCollection("watchlist", !watchlist)} disabled={pending !== null} className={watchlist ? "accent-button" : "quiet-button"}>
          {pending === "watchlist" ? "Saving…" : watchlist ? "✓ On watchlist" : "+ Watchlist"}
        </button>
        <button type="button" onClick={() => updateCollection("favorite", favoriteRank == null)} disabled={pending !== null} className={favoriteRank != null ? "quiet-button border-emerald-300/35 text-emerald-100" : "quiet-button"}>
          {pending === "favorite" ? "Saving…" : favoriteRank != null ? `★ Top 10 · #${favoriteRank}` : "☆ Add to Top 10"}
        </button>
      </div>
      {notice && <p role="status" className="text-xs font-medium text-emerald-200">{notice}</p>}
    </div>
  );
}
