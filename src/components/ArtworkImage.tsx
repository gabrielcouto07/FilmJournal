"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  src?: string | null;
  fallbackSrc?: string | null;
  alt: string;
  title?: string;
  className?: string;
  eager?: boolean;
  sizes?: string;
  fit?: "cover" | "contain";
};

function initials(value: string) {
  const words = value.replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "FJ";
  return (words.length === 1 ? words[0].slice(0, 2) : `${words[0][0]}${words.at(-1)?.[0] ?? ""}`).toUpperCase();
}

export default function ArtworkImage({
  src,
  fallbackSrc,
  alt,
  title,
  className = "",
  eager = false,
  sizes = "(max-width: 640px) 45vw, 220px",
  fit = "cover",
}: Props) {
  const sources = useMemo(() => [...new Set([src, fallbackSrc].filter((value): value is string => Boolean(value?.trim())))], [fallbackSrc, src]);
  const sourceKey = sources.join("|");
  const [sourceIndex, setSourceIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const label = title?.trim() || alt.replace(/\s+poster$/i, "").trim() || "Filme";
  const activeSource = sources[sourceIndex] ?? null;

  useEffect(() => {
    setSourceIndex(0);
    setLoaded(false);
  }, [sourceKey]);

  useEffect(() => {
    const image = imageRef.current;
    // Cached eager images can complete before React attaches onLoad during hydration.
    if (image?.complete && image.naturalWidth > 0) setLoaded(true);
  }, [activeSource]);

  function tryFallback() {
    setLoaded(false);
    setSourceIndex((index) => index + 1);
  }

  return <span className={`artwork-frame ${className}`} data-loaded={loaded}>
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
