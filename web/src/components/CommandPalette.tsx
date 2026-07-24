"use client";

import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Result = { id: string; title: string; year: number | null };

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editing = target?.matches("input, textarea, select, [contenteditable=true]");
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setOpen((value) => !value); }
      else if (event.key === "/" && !editing) { event.preventDefault(); setOpen(true); }
      else if (event.key === "Escape") setOpen(false);
    };
    const show = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", show);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("open-command-palette", show); };
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    if (query.trim().length < 1) { setResults([]); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await apiFetch(`/movies?q=${encodeURIComponent(query.trim())}&limit=6`, { signal: controller.signal });
        const payload = await response.json() as { movies?: Result[] };
        setResults(payload.movies ?? []);
      } catch { if (!controller.signal.aborted) setResults([]); }
    }, 180);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query]);

  if (!open) return null;
  const quickLinks = [{ href: "/diary", label: "Abrir diário" }, { href: "/search", label: "Descobrir um filme" }, { href: "/", label: "Ver seu paladar" }];
  return <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/70 px-4 pt-[12vh] backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Busca rápida" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
    <section className="modal-enter surface-raised w-full max-w-2xl overflow-hidden rounded-[1.5rem]">
      <div className="flex items-center gap-3 border-b border-white/[0.08] px-5 py-4">
        <span className="text-amber-300" aria-hidden="true">⌕</span>
        <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Busque no seu acervo ou vá direto a algum lugar…" className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-slate-600" />
        <kbd className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-bold text-slate-500">ESC</kbd>
      </div>
      <div className="max-h-[55vh] overflow-y-auto p-3">
        {results.length > 0 ? <div className="space-y-1">{results.map((movie) => <Link key={movie.id} href={`/film/${movie.id}`} onClick={() => setOpen(false)} className="flex items-center justify-between rounded-xl px-3 py-3 text-sm transition hover:bg-white/[0.06]"><span className="font-bold text-white">{movie.title}</span><span className="text-xs text-slate-500">{movie.year ?? "—"}</span></Link>)}</div> : <div className="grid gap-2 sm:grid-cols-3">{quickLinks.map((link) => <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 text-sm font-bold text-slate-300 transition hover:border-amber-300/25 hover:text-white">{link.label}</Link>)}</div>}
        {query.trim().length > 1 && <Link href={`/search?query=${encodeURIComponent(query.trim())}`} onClick={() => setOpen(false)} className="mt-3 flex items-center justify-between rounded-xl bg-amber-300/10 px-3 py-3 text-sm font-bold text-amber-200"><span>Buscar no TMDb por “{query.trim()}”</span><span>→</span></Link>}
      </div>
    </section>
  </div>;
}
