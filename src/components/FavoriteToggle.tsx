"use client";

import { useState } from "react";
import { useToast } from "./ToastProvider";

type Props = { movieId: string; initialFavorite: boolean; compact?: boolean };

export default function FavoriteToggle({ movieId, initialFavorite, compact = false }: Props) {
  const [favorite, setFavorite] = useState(initialFavorite);
  const [saving, setSaving] = useState(false);
  const { notify } = useToast();

  async function toggleFavorite() {
    const next = !favorite;
    setFavorite(next);
    setSaving(true);
    try {
      const response = await fetch("/api/movies", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ movieId, action: "favorite", value: next }) });
      const payload = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível atualizar os favoritos.");
      notify(payload.message ?? "Favoritos atualizados.");
    } catch (error) {
      setFavorite(!next);
      notify(error instanceof Error ? error.message : "Não foi possível atualizar os favoritos.", "error");
    } finally { setSaving(false); }
  }

  return <button type="button" onClick={toggleFavorite} disabled={saving} aria-pressed={favorite} aria-label={favorite ? "Remover dos filmes favoritos" : "Adicionar aos filmes favoritos"} className={`${compact ? "h-9 w-9" : "gap-2 px-3 py-2"} icon-button ${favorite ? "border-amber-300/50 bg-amber-300/12 text-amber-200" : ""}`}>
    <span aria-hidden="true">{favorite ? "♥" : "♡"}</span>{!compact && <span className="text-xs font-bold">{favorite ? "Favorito" : "Favorito"}</span>}
  </button>;
}
