"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Fires TMDB metadata enrichment AFTER paint (never blocking render), then
 * refreshes the route only if something was actually filled in. Converges: once
 * movies have metadata the endpoint enriches nothing and no refresh happens.
 */
export default function BackgroundEnrich({ movieIds, when = true }: { movieIds?: string[]; when?: boolean }) {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (!when || started.current) return;
    started.current = true;
    const payload = movieIds && movieIds.length ? { movieIds } : { limit: 12 };
    fetch("/api/movies/enrich", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data && data.enriched > 0) router.refresh(); })
      .catch(() => { /* metadata is best-effort */ });
  }, [when, movieIds, router]);

  return null;
}
