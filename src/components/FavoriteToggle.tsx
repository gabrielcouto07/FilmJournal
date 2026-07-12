"use client";

import { useState } from "react";

type FavoriteToggleProps = {
  logId: string;
  initialFavorite: boolean;
  compact?: boolean;
};

export default function FavoriteToggle({ logId, initialFavorite, compact = false }: FavoriteToggleProps) {
  const [favorite, setFavorite] = useState(initialFavorite);
  const [saving, setSaving] = useState(false);

  async function toggleFavorite() {
    const nextValue = !favorite;
    setFavorite(nextValue);
    setSaving(true);
    try {
      const response = await fetch("/api/logs", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: logId, favorite: nextValue }) });
      if (!response.ok) throw new Error("Could not save favorite.");
    } catch {
      setFavorite(!nextValue);
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggleFavorite}
      disabled={saving}
      aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
      className={`${compact ? "h-8 w-8" : "gap-2 px-3 py-1.5"} icon-button ${favorite ? "border-emerald-300/50 bg-emerald-300/10 text-emerald-200" : ""}`}
    >
      <span aria-hidden="true">{favorite ? "★" : "☆"}</span>
      {!compact && <span className="text-xs font-bold">{favorite ? "Saved" : "Save"}</span>}
    </button>
  );
}
