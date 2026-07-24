"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getBackdropUrl, getPosterUrl, type TmdbPoster } from "@/lib/tmdb";
import ArtworkImage from "./ArtworkImage";
import { useToast } from "./ToastProvider";

type Props = { movieId: string; tmdbId: number | null; initialPosterPath: string | null; defaultPosterPath: string | null; initialBackdropPath: string | null; title: string };
type DetailsResponse = { movie?: { poster_path?: string | null; backdrop_path?: string | null; images?: { posters?: TmdbPoster[]; backdrops?: TmdbPoster[] } }; error?: string };

export default function PosterPicker({ movieId, tmdbId, initialPosterPath, defaultPosterPath, initialBackdropPath, title }: Props) {
  const [posterPath, setPosterPath] = useState(initialPosterPath);
  const [backdropPath, setBackdropPath] = useState(initialBackdropPath);
  const [posters, setPosters] = useState<TmdbPoster[]>([]);
  const [backdrops, setBackdrops] = useState<TmdbPoster[]>([]);
  const [tab, setTab] = useState<"poster" | "backdrop">("poster");
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const { notify } = useToast();
  const router = useRouter();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", close); document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", close); document.body.style.overflow = ""; };
  }, [open]);

  async function showPicker() {
    setOpen(true); setError("");
    if ((posters.length || backdrops.length) || !tmdbId) return;
    setLoading(true);
    try {
      const response = await apiFetch(`/tmdb?id=${tmdbId}`);
      const payload = await response.json() as DetailsResponse;
      if (!response.ok || !payload.movie) throw new Error(payload.error ?? "Não foi possível carregar as imagens.");
      const unique = (items: TmdbPoster[]) => [...new Map(items.map((item) => [item.file_path, item])).values()];
      setPosters(unique(payload.movie.images?.posters ?? []).slice(0, 36));
      setBackdrops(unique(payload.movie.images?.backdrops ?? []).slice(0, 30));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível carregar as imagens."); }
    finally { setLoading(false); }
  }

  async function select(path: string) {
    const previous = tab === "poster" ? posterPath : backdropPath;
    if (path === previous) return;
    if (tab === "poster") setPosterPath(path); else setBackdropPath(path);
    setSaving(path); setError("");
    try {
      const response = await apiFetch("/movies", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ movieId, action: tab, value: path }) });
      const payload = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível salvar a imagem.");
      notify(payload.message ?? "Imagem atualizada."); setOpen(false); router.refresh();
    } catch (reason) {
      if (tab === "poster") setPosterPath(previous); else setBackdropPath(previous);
      const message = reason instanceof Error ? reason.message : "Não foi possível salvar a imagem."; setError(message); notify(message, "error");
    } finally { setSaving(null); }
  }

  const posterUrl = getPosterUrl(posterPath);
  const defaultPosterUrl = getPosterUrl(defaultPosterPath);
  const images = tab === "poster" ? posters : backdrops;
  return <>
    <div className="film-poster-showcase poster-card group relative mx-auto w-full max-w-[18rem] shrink-0 overflow-hidden rounded-[1.4rem] border border-white/15 bg-black/35 p-1.5 shadow-[0_32px_80px_rgba(0,0,0,.62)] sm:max-w-[20rem] lg:max-w-[22rem]">
      <ArtworkImage src={posterUrl} fallbackSrc={defaultPosterUrl} alt={`Pôster de ${title}`} title={title} className="aspect-[2/3] w-full rounded-[1.05rem]" eager fit="contain" sizes="(max-width: 640px) 288px, (max-width: 1024px) 320px, 352px" />
      {tmdbId && <button type="button" onClick={showPicker} className="absolute inset-x-5 bottom-5 z-10 translate-y-1 rounded-full border border-white/20 bg-black/80 px-4 py-2.5 text-xs font-bold text-white opacity-90 shadow-lg backdrop-blur-md transition hover:border-amber-300/40 hover:bg-black group-hover:translate-y-0 group-hover:opacity-100 focus:translate-y-0 focus:opacity-100">Personalizar imagem</button>}
    </div>
    {/* Portal para o body: o modal não herda overflow/transform da ficha do filme. */}
    {open && mounted && createPortal(
      <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/80 backdrop-blur-md sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="artwork-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
        <section className="modal-enter surface-raised flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-[1.75rem] sm:max-h-[85vh] sm:rounded-[1.75rem]">
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-white/[0.08] p-5 sm:px-7 sm:py-6">
            <div>
              <p className="eyebrow">Coleção de imagens do TMDb</p>
              <h2 id="artwork-title" className="mt-2 text-xl font-black text-white sm:text-2xl">Dê a {title} seu próprio visual.</h2>
              <p className="mt-1 text-sm text-slate-500">A escolha vale para todo o catálogo: painel, diário, listas e página do filme.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="icon-button h-9 w-9 shrink-0" aria-label="Fechar seletor de imagens">×</button>
          </header>
          <div className="flex shrink-0 gap-2 border-b border-white/[0.07] px-5 py-3 sm:px-7">
            {(["poster", "backdrop"] as const).map((value) => (
              <button type="button" key={value} onClick={() => setTab(value)} className={`rounded-full px-4 py-2 text-xs font-bold transition ${tab === value ? "bg-amber-300 text-black" : "text-slate-500 hover:bg-white/[0.05] hover:text-white"}`}>
                {({ poster: "Pôsteres", backdrop: "Planos de fundo" })[value]}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-7">
            {loading && <div className={`grid gap-3 ${tab === "poster" ? "grid-cols-3 sm:grid-cols-5 lg:grid-cols-7" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"}`}>{Array.from({ length: 12 }, (_, index) => <div key={index} className={`shimmer rounded-xl ${tab === "poster" ? "aspect-[2/3]" : "aspect-video"}`} />)}</div>}
            {error && <p role="alert" className="mb-4 rounded-xl border border-red-300/20 bg-red-300/[0.06] p-3 text-sm text-red-100">{error}</p>}
            {!loading && images.length > 0 && <div className={`grid gap-3 ${tab === "poster" ? "grid-cols-3 sm:grid-cols-5 lg:grid-cols-7" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"}`}>{images.map((image) => {
              const current = tab === "poster" ? posterPath : backdropPath;
              const url = tab === "poster" ? getPosterUrl(image.file_path) : getBackdropUrl(image.file_path);
              return <button type="button" key={image.file_path} disabled={saving !== null} onClick={() => select(image.file_path)} className={`relative overflow-hidden rounded-xl border-2 transition duration-300 hover:-translate-y-1 ${current === image.file_path ? "border-amber-300 shadow-[0_0_28px_rgba(245,197,24,.2)]" : "border-transparent hover:border-white/25"}`}><ArtworkImage src={url} alt={`Imagem alternativa de ${title}`} title={title} className={`w-full ${tab === "poster" ? "aspect-[2/3]" : "aspect-video"}`} sizes={tab === "poster" ? "160px" : "280px"} />{current === image.file_path && <span className="absolute right-2 top-2 z-10 rounded-full bg-amber-300 px-2 py-1 text-[9px] font-black uppercase text-black">Atual</span>}{saving === image.file_path && <span className="absolute inset-0 z-10 grid place-items-center bg-black/65 text-xs font-bold">Salvando…</span>}</button>;
            })}</div>}
            {!loading && !error && !images.length && <p className="py-12 text-center text-sm text-slate-500">Nenhuma imagem alternativa disponível para este filme.</p>}
          </div>
        </section>
      </div>,
      document.body,
    )}
  </>;
}
