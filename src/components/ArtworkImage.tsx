"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  src?: string | null;
  fallbackSrc?: string | null;
  movieId?: string;
  alt: string;
  title?: string;
  className?: string;
  eager?: boolean;
  sizes?: string;
  fit?: "cover" | "contain";
};

const artworkRequests = new Map<string, Promise<string | null>>();

function resolveArtwork(key: string, payload: { movieId?: string; title?: string }): Promise<string | null> {
  const existing = artworkRequests.get(key);
  if (existing) return existing;

  const request = fetch("/api/movies/artwork", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then(async (response) => {
    if (!response.ok) return null;
    const payload = await response.json() as { posterUrl?: unknown };
    return typeof payload.posterUrl === "string" ? payload.posterUrl : null;
  }).catch(() => null);

  artworkRequests.set(key, request);
  return request;
}

function initials(value: string) {
  const words = value.replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "FJ";
  return (words.length === 1 ? words[0].slice(0, 2) : `${words[0][0]}${words.at(-1)?.[0] ?? ""}`).toUpperCase();
}

export default function ArtworkImage({
  src,
  fallbackSrc,
  movieId,
  alt,
  title,
  className = "",
  eager = false,
  sizes = "(max-width: 640px) 45vw, 220px",
  fit = "cover",
}: Props) {
  const [resolvedSource, setResolvedSource] = useState<string | null>(null);
  const sources = useMemo(() => [...new Set([src, fallbackSrc, resolvedSource].filter((value): value is string => Boolean(value?.trim())))], [fallbackSrc, resolvedSource, src]);
  const sourceKey = sources.join("|");
  const [sourceIndex, setSourceIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const frameRef = useRef<HTMLSpanElement | null>(null);
  const requestedRef = useRef(false);
  const label = title?.trim() || alt.replace(/\s+poster$/i, "").trim() || "Filme";
  const activeSource = sources[sourceIndex] ?? null;
  const resolverKey = movieId ? `id:${movieId}` : title?.trim() ? `title:${title.trim()}` : null;

  useEffect(() => {
    setSourceIndex(0);
    setLoaded(false);
  }, [sourceKey]);

  useEffect(() => {
    requestedRef.current = false;
    setResolvedSource(null);
  }, [resolverKey]);

  useEffect(() => {
    if (activeSource || !resolverKey || requestedRef.current) return;
    const frame = frameRef.current;
    if (!frame) return;

    const load = () => {
      if (requestedRef.current) return;
      requestedRef.current = true;
      void resolveArtwork(resolverKey, movieId ? { movieId } : { title: title?.trim() }).then((posterUrl) => {
        if (posterUrl) setResolvedSource(posterUrl);
      });
    };

    if (!("IntersectionObserver" in window)) {
      load();
      return;
    }

    const observer = new IntersectionObserver((records) => {
      if (records.some((record) => record.isIntersecting)) {
        observer.disconnect();
        load();
      }
    }, { rootMargin: "240px" });
    observer.observe(frame);
    return () => observer.disconnect();
  }, [activeSource, movieId, resolverKey, title]);

  useEffect(() => {
    const image = imageRef.current;
    // Cached eager images can complete before React attaches onLoad during hydration.
    if (image?.complete && image.naturalWidth > 0) setLoaded(true);
  }, [activeSource]);

  function tryFallback() {
    setLoaded(false);
    setSourceIndex((index) => index + 1);
  }

  return <span ref={frameRef} className={`artwork-frame ${className}`} data-loaded={loaded}>
    <span className="poster-fallback" role={activeSource ? undefined : "img"} aria-label={activeSource ? undefined : `Pôster de ${label} indisponível`}>
      <span aria-hidden="true" className="poster-fallback-mark">{initials(label)}</span>
      <span className="poster-fallback-title">{label}</span>
      <span className="poster-fallback-note">Imagem indisponível</span>
    </span>
    {activeSource && <Image
      key={activeSource}
      ref={imageRef}
      src={activeSource}
      alt={alt}
      fill
      sizes={sizes}
      priority={eager}
      className={`poster-image ${fit === "contain" ? "object-contain" : "object-cover"}`}
      data-loaded={loaded}
      onLoad={(event) => {
        if (event.currentTarget.naturalWidth > 0) setLoaded(true);
      }}
      onError={tryFallback}
    />}
  </span>;
}
