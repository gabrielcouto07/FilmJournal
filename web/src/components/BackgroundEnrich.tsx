"use client";

import { apiFetch } from "@/lib/api";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/** Completa dados do TMDB após a tela abrir e atualiza só quando algo mudou. */
export default function BackgroundEnrich({ movieIds, when = true }: { movieIds?: string[]; when?: boolean }) {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (!when || started.current) return;
    started.current = true;
    const payload = movieIds && movieIds.length ? { movieIds } : { limit: 12 };
    apiFetch("/movies/enrich", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data && data.enriched > 0) router.refresh(); })
      .catch(() => { /* metadata is best-effort */ });
  }, [when, movieIds, router]);

  return null;
}
