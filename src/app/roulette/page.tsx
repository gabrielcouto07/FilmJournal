"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import ArtworkImage from "@/components/ArtworkImage";
import { useToast } from "@/components/ToastProvider";

// --- Types (mirror the /api/roulette/* response shapes) ---
type Genre = { id: number; name: string };
type Person = { id: number; name: string; department: string | null; knownFor: string[] };
type PoolMovie = {
  id: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  backdropPath: string | null;
  rating: number | null;
  overview: string | null;
  genreIds: number[];
  /** Blind-spot picks explain themselves in the reveal. */
  rationale?: string;
  gapLabel?: string;
};

type Source = "popular" | "watchlist" | "blindspots";

const SOURCES: Array<{ id: Source; label: string; hint: string }> = [
  { id: "popular", label: "Populares (TMDB)", hint: "o catálogo mundial" },
  { id: "watchlist", label: "Para assistir", hint: "o que você guardou para ver" },
  { id: "blindspots", label: "Pontos cegos", hint: "as lacunas do seu mapa" },
];
type WinnerDetail = {
  id: number;
  title: string;
  year: number | null;
  runtime: number | null;
  genres: string[];
  overview: string | null;
  backdropPath: string | null;
  posterPath: string | null;
  rating: number | null;
};

const COUNT_OPTIONS = [4, 8, 16];
const RUNTIME_MAX = 240;

// --- Reel geometry -----------------------------------------------------------
// The reel is a long strip whose left edge is pinned to the viewport centre
// (left:50%). Translating it by `xFor(i)` centres reel-item `i` under the
// fixed selection frame — independent of viewport width, so landing is exact.
const ITEM_W = 150; // poster width in px
const ITEM_GAP = 16;
const STRIDE = ITEM_W + ITEM_GAP; // distance between consecutive item centres
const TARGET_BASE = 6; // pool repetition the spin lands on (defines runway)
const RESET_BASE = 2; // repetition each spin instantly resets to before running
const REPEATS = TARGET_BASE + 3; // total pool copies rendered into the strip
const SPIN_MS = 5000;
const STAGE_H = ITEM_W * 1.5 + 44; // reel stage height; keeps frame + strip co-centred
const xFor = (i: number) => -(i * STRIDE + ITEM_W / 2);

function tmdbImage(path: string | null, size: "w342" | "w780" | "w1280"): string | null {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path.startsWith("/") ? path : `/${path}`}`;
}

// Unbiased random index via rejection sampling over crypto randomness.
function randomIndex(max: number): number {
  if (max <= 1) return 0;
  const array = new Uint32Array(1);
  const maxUint32 = 0xffffffff;
  const limit = maxUint32 - (maxUint32 % max);
  let value: number;
  do {
    window.crypto.getRandomValues(array);
    value = array[0];
  } while (value >= limit);
  return value % max;
}

export default function RoulettePage() {
  const { notify } = useToast();
  const router = useRouter();

  // Filter state
  const [source, setSource] = useState<Source>("popular");
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenreIds, setSelectedGenreIds] = useState<number[]>([]);
  const [peopleQuery, setPeopleQuery] = useState("");
  const [peopleResults, setPeopleResults] = useState<Person[]>([]);
  const [selectedPeople, setSelectedPeople] = useState<Person[]>([]);
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [runtimeMax, setRuntimeMax] = useState(RUNTIME_MAX);
  const [count, setCount] = useState(8);

  // Which filters make sense depends on the source: people search is a TMDB
  // discover feature; a runtime ceiling needs known runtimes (unknown for
  // blind-spot candidates until their reveal).
  const peopleEnabled = source === "popular";
  const runtimeEnabled = source !== "blindspots";

  // Roulette state
  const [pool, setPool] = useState<PoolMovie[]>([]);
  const [building, setBuilding] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [winnerIndex, setWinnerIndex] = useState(-1);
  const [winnerDetail, setWinnerDetail] = useState<WinnerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showReveal, setShowReveal] = useState(false);
  const [flash, setFlash] = useState(false);
  const [blur, setBlur] = useState(false);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [savingWatchlist, setSavingWatchlist] = useState(false);
  const [mounted, setMounted] = useState(false);

  const controls = useAnimationControls();
  const blurTimer = useRef<number | null>(null);
  const flashTimer = useRef<number | null>(null);

  const genreMap = useMemo(() => new Map(genres.map((g) => [g.id, g.name])), [genres]);
  const poolKey = useMemo(() => `${pool.length}:${pool[0]?.id ?? 0}`, [pool]);
  const reelItems = useMemo(
    () => (pool.length ? Array.from({ length: REPEATS }, (_, r) => pool.map((m, i) => ({ m, key: `${r}-${i}-${m.id}` }))).flat() : []),
    [pool],
  );

  useEffect(() => setMounted(true), []);

  // Load the TMDB genre list once for the chips.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/roulette/genres");
        const data = await res.json();
        if (!cancelled && res.ok) setGenres(data.genres ?? []);
      } catch {
        /* non-fatal: chips just stay empty */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Restore the last-used filter set (persisted per user across devices).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/roulette/prefs");
        const data = await res.json();
        const prefs = res.ok ? data.prefs : null;
        if (cancelled || !prefs) return;
        setSource(prefs.source);
        setSelectedGenreIds(prefs.genres);
        setSelectedPeople(prefs.people.map((p: { id: number; name: string }) => ({ ...p, department: null, knownFor: [] })));
        setYearFrom(prefs.yearFrom);
        setYearTo(prefs.yearTo);
        setRuntimeMax(prefs.runtimeMax);
        setCount(prefs.count);
      } catch {
        /* non-fatal: defaults stand */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced (400ms) person autocomplete.
  useEffect(() => {
    const query = peopleQuery.trim();
    if (query.length < 2) {
      setPeopleResults([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/roulette/people?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (res.ok) setPeopleResults(data.people ?? []);
      } catch {
        /* ignore */
      }
    }, 400);
    return () => window.clearTimeout(handle);
  }, [peopleQuery]);

  useEffect(
    () => () => {
      if (blurTimer.current) window.clearTimeout(blurTimer.current);
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
    },
    [],
  );

  // Park the freshly-built reel so the first poster sits under the frame.
  useEffect(() => {
    if (pool.length) controls.set({ x: xFor(RESET_BASE * pool.length) });
  }, [poolKey, pool.length, controls]);

  // Close the reveal with Escape.
  useEffect(() => {
    if (!showReveal) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowReveal(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showReveal]);

  const toggleGenre = (id: number) => {
    setSelectedGenreIds((current) =>
      current.includes(id) ? current.filter((g) => g !== id) : [...current, id],
    );
  };

  const addPerson = (person: Person) => {
    setSelectedPeople((current) => (current.some((p) => p.id === person.id) ? current : [...current, person]));
    setPeopleQuery("");
    setPeopleResults([]);
  };

  const removePerson = (id: number) => {
    setSelectedPeople((current) => current.filter((p) => p.id !== id));
  };

  const resetAll = () => {
    setSource("popular");
    setSelectedGenreIds([]);
    setSelectedPeople([]);
    setPeopleQuery("");
    setPeopleResults([]);
    setYearFrom("");
    setYearTo("");
    setRuntimeMax(RUNTIME_MAX);
    setCount(8);
    setPool([]);
    setWinnerIndex(-1);
    setWinnerDetail(null);
    setShowReveal(false);
  };

  const buildPool = async () => {
    setBuilding(true);
    setPool([]);
    setWinnerIndex(-1);
    setWinnerDetail(null);
    setShowReveal(false);
    try {
      const params = new URLSearchParams();
      params.set("source", source);
      if (selectedGenreIds.length) params.set("genres", selectedGenreIds.join(","));
      if (peopleEnabled && selectedPeople.length) params.set("people", selectedPeople.map((p) => p.id).join(","));
      if (yearFrom) params.set("yearFrom", yearFrom);
      if (yearTo) params.set("yearTo", yearTo);
      if (runtimeEnabled && runtimeMax < RUNTIME_MAX) params.set("runtimeMax", String(runtimeMax));
      params.set("count", String(count));

      // Remember this setup for the next visit (fire-and-forget).
      void fetch("/api/roulette/prefs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          genres: selectedGenreIds,
          people: selectedPeople.map((p) => ({ id: p.id, name: p.name })),
          yearFrom,
          yearTo,
          runtimeMax,
          count,
        }),
      }).catch(() => {});

      const res = await fetch(`/api/roulette/discover?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || "Serviço temporariamente indisponível. Tente novamente.", "error");
        return;
      }
      setPool(data.movies ?? []);
      if ((data.movies ?? []).length === 0) {
        notify("Nenhum filme encontrado com esses filtros — tente ajustá-los.", "info");
      }
    } catch {
      notify("Serviço temporariamente indisponível. Tente novamente.", "error");
    } finally {
      setBuilding(false);
    }
  };

  const fetchWinnerDetail = useCallback(async (movieId: number) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/roulette/discover?movieId=${movieId}`);
      const data = await res.json();
      if (res.ok) setWinnerDetail(data.movie);
    } catch {
      /* the reveal already shows the pool essentials */
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const spin = useCallback(async () => {
    if (pool.length === 0 || spinning) return;
    setShowReveal(false);
    setWinnerDetail(null);
    setSpinning(true);

    const target = randomIndex(pool.length);
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion || pool.length === 1) {
      controls.set({ x: xFor(TARGET_BASE * pool.length + target) });
      setWinnerIndex(target);
      setSpinning(false);
      setShowReveal(true);
      void fetchWinnerDetail(pool[target].id);
      return;
    }

    // Instantly park on an identical-looking earlier repetition (same poster
    // centred as the previous result) so there is runway and no visible jump.
    const fromCentered = winnerIndex >= 0 ? winnerIndex : 0;
    controls.set({ x: xFor(RESET_BASE * pool.length + fromCentered) });

    setBlur(true);
    if (blurTimer.current) window.clearTimeout(blurTimer.current);
    blurTimer.current = window.setTimeout(() => setBlur(false), SPIN_MS - 1200);

    const targetIndex = TARGET_BASE * pool.length + target;
    await controls.start({ x: xFor(targetIndex) }, { duration: SPIN_MS / 1000, ease: [0.16, 1, 0.3, 1] });

    setBlur(false);
    setWinnerIndex(target);
    setSpinning(false);
    setFlash(true);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(false), 900);
    void fetchWinnerDetail(pool[target].id);
    window.setTimeout(() => setShowReveal(true), 260);
  }, [pool, spinning, winnerIndex, controls, fetchWinnerDetail]);

  // POST the TMDB movie into the catalog, then open its film page.
  const openMovie = useCallback(
    async (movie: { id: number; title: string }) => {
      if (openingId) return;
      setOpeningId(movie.id);
      try {
        const res = await fetch("/api/movies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tmdbId: movie.id }),
        });
        const data = (await res.json()) as { movie?: { id: string }; error?: string };
        if (!res.ok || !data.movie) throw new Error(data.error ?? "Não foi possível abrir este filme.");
        router.push(`/film/${data.movie.id}`);
      } catch (reason) {
        notify(reason instanceof Error ? reason.message : "Não foi possível abrir este filme.", "error");
        setOpeningId(null);
      }
    },
    [openingId, router, notify],
  );

  const addToWatchlist = useCallback(
    async (movie: { id: number; title: string }) => {
      if (savingWatchlist) return;
      setSavingWatchlist(true);
      try {
        const res = await fetch("/api/movies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tmdbId: movie.id, watchlist: true }),
        });
        const data = (await res.json()) as { message?: string; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Não foi possível adicionar à sua lista.");
        notify(data.message ?? `${movie.title} adicionado à sua lista para assistir.`);
      } catch (reason) {
        notify(reason instanceof Error ? reason.message : "Não foi possível adicionar à sua lista.", "error");
      } finally {
        setSavingWatchlist(false);
      }
    },
    [savingWatchlist, notify],
  );

  const hasResult = winnerIndex >= 0 && !spinning;
  const winner = winnerIndex >= 0 ? pool[winnerIndex] : null;
  const filtersDisabled = building || spinning;

  return (
    <main className="page-shell max-w-6xl space-y-10">
      <header>
        <p className="eyebrow">Assistente de Seleção</p>
        <h1 className="display-title mt-3 text-5xl sm:text-7xl">Roleta de Filmes.</h1>
        <p className="mt-4 max-w-2xl leading-7 text-slate-400">
          Não sabe o que assistir? Escolha de onde sortear — do catálogo mundial, da sua lista
          para assistir ou dos seus pontos cegos —, ajuste os filtros e deixe o acaso escolher a
          sessão de hoje.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[21rem_1fr]">
        {/* Filters */}
        <aside className="surface h-fit rounded-[2rem] border border-white/[0.05] p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-black text-white">Filtros</h2>
            <button onClick={resetAll} disabled={filtersDisabled} className="text-xs font-bold text-amber-300 hover:text-amber-200 disabled:opacity-40">
              Limpar
            </button>
          </div>

          <div className="space-y-6">
            {/* Source — where the pool comes from */}
            <div className="space-y-2">
              <span className="block text-xs font-black uppercase tracking-wider text-slate-500">De onde sortear</span>
              <div className="space-y-1.5">
                {SOURCES.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    disabled={filtersDisabled}
                    onClick={() => setSource(option.id)}
                    className={`flex w-full items-baseline justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-left transition disabled:opacity-40 ${
                      source === option.id
                        ? "border-amber-300/60 bg-amber-300/10 text-amber-100"
                        : "border-white/[0.08] bg-white/[0.02] text-slate-400 hover:border-white/20 hover:text-white"
                    }`}
                  >
                    <span className="text-sm font-black">{option.label}</span>
                    <span className="text-[10px] font-bold text-slate-600">{option.hint}</span>
                  </button>
                ))}
              </div>
              {source === "blindspots" && (
                <p className="text-[11px] leading-4 text-slate-500">
                  A roleta gira sobre filmes aclamados das lacunas do seu mapa — o sorteado explica por que apareceu.
                </p>
              )}
            </div>

            {/* Genres */}
            <div className="space-y-2">
              <span className="block text-xs font-black uppercase tracking-wider text-slate-500">Gênero(s)</span>
              <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto pr-1">
                {genres.length === 0 && <span className="text-xs text-slate-600">Carregando gêneros…</span>}
                {genres.map((genre) => {
                  const selected = selectedGenreIds.includes(genre.id);
                  return (
                    <button
                      key={genre.id}
                      type="button"
                      disabled={filtersDisabled}
                      onClick={() => toggleGenre(genre.id)}
                      className={`chip !px-2.5 !py-1 text-[11px] disabled:opacity-40 ${selected ? "border-amber-300 bg-amber-300 font-black text-black" : ""}`}
                    >
                      {genre.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* People (TMDB discover only) */}
            <div className={`space-y-2 ${peopleEnabled ? "" : "hidden"}`}>
              <label htmlFor="people-search" className="block text-xs font-black uppercase tracking-wider text-slate-500">
                Ator(es) / Diretor
              </label>
              {selectedPeople.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedPeople.map((person) => (
                    <span key={person.id} className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/40 bg-amber-300/10 px-2.5 py-1 text-[11px] font-bold text-amber-100">
                      {person.name}
                      <button type="button" onClick={() => removePerson(person.id)} aria-label={`Remover ${person.name}`} className="text-amber-300 hover:text-white">×</button>
                    </span>
                  ))}
                </div>
              )}
              <div className="relative">
                <input
                  id="people-search"
                  type="text"
                  value={peopleQuery}
                  disabled={filtersDisabled}
                  onChange={(e) => setPeopleQuery(e.target.value)}
                  placeholder="ex.: Fernanda Torres"
                  className="field"
                  autoComplete="off"
                />
                {peopleResults.length > 0 && (
                  <ul className="surface-raised absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-white/10 p-1">
                    {peopleResults.map((person) => (
                      <li key={person.id}>
                        <button
                          type="button"
                          onClick={() => addPerson(person)}
                          className="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-white/[0.06]"
                        >
                          <span className="text-sm font-bold text-white">{person.name}</span>
                          <span className="text-[10px] text-slate-500">
                            {[person.department, person.knownFor.join(", ")].filter(Boolean).join(" · ")}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Release period */}
            <div className="space-y-2">
              <span className="block text-xs font-black uppercase tracking-wider text-slate-500">Período de lançamento</span>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500">De:</span>
                  <input type="number" inputMode="numeric" min={1900} max={2100} value={yearFrom} disabled={filtersDisabled} onChange={(e) => setYearFrom(e.target.value)} placeholder="1990" className="field !py-2 !px-2.5 w-20" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500">Até:</span>
                  <input type="number" inputMode="numeric" min={1900} max={2100} value={yearTo} disabled={filtersDisabled} onChange={(e) => setYearTo(e.target.value)} placeholder="2005" className="field !py-2 !px-2.5 w-20" />
                </div>
              </div>
            </div>

            {/* Runtime (needs known runtimes; blind-spot candidates have none yet) */}
            <div className={`space-y-2 ${runtimeEnabled ? "" : "hidden"}`}>
              <label htmlFor="runtime-range" className="flex justify-between text-xs font-black uppercase tracking-wider text-slate-500">
                <span>Duração máxima</span>
                <span className="font-bold text-amber-300">{runtimeMax < RUNTIME_MAX ? `Até ${runtimeMax} min` : "Qualquer"}</span>
              </label>
              <input id="runtime-range" type="range" min={60} max={RUNTIME_MAX} step={10} value={runtimeMax} disabled={filtersDisabled} onChange={(e) => setRuntimeMax(Number(e.target.value))} className="w-full accent-amber-300" />
            </div>

            {/* Count */}
            <div className="space-y-2">
              <label htmlFor="count-select" className="block text-xs font-black uppercase tracking-wider text-slate-500">Quantidade de filmes na roleta</label>
              <select id="count-select" value={count} disabled={filtersDisabled} onChange={(e) => setCount(Number(e.target.value))} className="field [color-scheme:dark]">
                {COUNT_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option} filmes</option>
                ))}
              </select>
            </div>

            <button onClick={buildPool} disabled={filtersDisabled} className="accent-button w-full justify-center py-3 font-black disabled:opacity-50">
              {building ? "Montando…" : "Montar Roleta"}
            </button>
          </div>
        </aside>

        {/* Pool + spin */}
        <section className="space-y-8">
          <div className="surface-subtle flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/[0.04] p-5">
            <p className="text-sm font-bold text-white">
              {building
                ? "Buscando no catálogo do TMDB…"
                : pool.length > 0
                  ? `${pool.length} filmes na roleta`
                  : "Monte a roleta para começar."}
            </p>
            {pool.length > 0 && (
              <button onClick={spin} disabled={spinning} className="accent-button gap-2 font-black disabled:cursor-not-allowed disabled:opacity-50">
                {spinning ? "Girando…" : hasResult ? "Girar de novo 🎲" : "Girar 🎲"}
              </button>
            )}
          </div>

          {/* The reel — the star of the show */}
          {!building && pool.length > 0 && (
            <div className="surface relative overflow-hidden rounded-[2rem] border border-white/[0.06] px-4 py-8">
              <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_45%,rgba(245,197,24,0.12),transparent_55%)]" />

              {/* Fixed-height stage keeps the selection frame and the strip perfectly co-centred */}
              <div className="relative mx-auto" style={{ height: STAGE_H }}>
                {/* Selection frame */}
                <div
                  className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-amber-300"
                  style={{
                    width: ITEM_W + 12,
                    height: ITEM_W * 1.5 + 12,
                    boxShadow: flash
                      ? "0 0 0 3px rgba(245,197,24,.5), 0 0 60px 12px rgba(245,197,24,.55)"
                      : "0 0 0 2px rgba(245,197,24,.25), 0 0 28px 4px rgba(245,197,24,.28)",
                    transition: "box-shadow .5s var(--ease-out)",
                  }}
                />
                {/* Pointers */}
                <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2" style={{ marginTop: -(ITEM_W * 1.5 + 12) / 2 - 14 }}>
                  <span className="block h-0 w-0 border-x-[9px] border-t-[12px] border-x-transparent border-t-amber-300" />
                </div>
                <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2" style={{ marginTop: (ITEM_W * 1.5 + 12) / 2 + 2 }}>
                  <span className="block h-0 w-0 border-x-[9px] border-b-[12px] border-x-transparent border-b-amber-300" />
                </div>

                {/* Reel strip with edge-fade mask */}
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={{
                    WebkitMaskImage: "linear-gradient(to right, transparent, #000 14%, #000 86%, transparent)",
                    maskImage: "linear-gradient(to right, transparent, #000 14%, #000 86%, transparent)",
                  }}
                >
                  <motion.div
                    key={poolKey}
                    animate={controls}
                    initial={{ x: xFor(RESET_BASE * pool.length) }}
                    className="absolute inset-y-0 left-1/2 flex items-center"
                    style={{ gap: ITEM_GAP, filter: blur ? "blur(1.4px)" : "none", willChange: "transform" }}
                  >
                    {reelItems.map(({ m, key }) => (
                      <div
                        key={key}
                        className="relative shrink-0 overflow-hidden rounded-xl border border-white/[0.08] bg-[#18181b]"
                        style={{ width: ITEM_W, height: ITEM_W * 1.5 }}
                      >
                        <ArtworkImage
                          src={tmdbImage(m.posterPath, "w342")}
                          fallbackSrc={null}
                          alt={m.title}
                          title={m.title}
                          className="h-full w-full object-cover"
                          sizes="150px"
                        />
                        {m.rating != null && m.rating > 0 && (
                          <span className="absolute right-1.5 top-1.5 rounded-full border border-white/10 bg-black/70 px-1.5 py-0.5 text-[10px] font-black text-amber-200 backdrop-blur">
                            ★ {m.rating.toFixed(1)}
                          </span>
                        )}
                      </div>
                    ))}
                  </motion.div>
                </div>
              </div>

              {!spinning && !hasResult && (
                <p className="mt-6 text-center text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                  Aperte <span className="text-amber-300">Girar</span> para sortear
                </p>
              )}
            </div>
          )}

          {/* Inline result bar (when reveal is dismissed) */}
          <AnimatePresence>
            {hasResult && winner && !showReveal && (
              <motion.div
                key="result-bar"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="surface flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/25 p-4"
              >
                <p className="text-sm font-bold text-white">
                  🎬 Sorteado: <span className="text-amber-300">{winner.title}</span> {winner.year ? `(${winner.year})` : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setShowReveal(true)} className="quiet-button px-4 py-2 text-xs">Ver detalhes</button>
                  <button onClick={() => openMovie(winner)} disabled={openingId === winner.id} className="accent-button px-4 py-2 text-xs disabled:opacity-60">
                    {openingId === winner.id ? "Abrindo…" : "Abrir filme"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Building skeleton */}
          {building && (
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(130px,1fr))] sm:[grid-template-columns:repeat(auto-fill,minmax(160px,1fr))]">
              {Array.from({ length: count }).map((_, index) => (
                <div key={index} className="shimmer aspect-[2/3] rounded-xl" />
              ))}
            </div>
          )}

          {/* Candidate grid — every card opens its film page */}
          {!building && pool.length > 0 && (
            <div>
              <p className="mb-3 text-xs font-black uppercase tracking-wider text-slate-500">
                Todos os candidatos <span className="text-slate-600">· clique para abrir</span>
              </p>
              <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(130px,1fr))] sm:[grid-template-columns:repeat(auto-fill,minmax(160px,1fr))]">
                {pool.map((movie, index) => {
                  const isWinner = hasResult && winnerIndex === index;
                  return (
                    <motion.button
                      type="button"
                      key={`${movie.id}-${index}`}
                      onClick={() => openMovie(movie)}
                      disabled={openingId != null}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: hasResult && !isWinner ? 0.5 : 1, y: 0, scale: isWinner ? 1.06 : 1 }}
                      transition={{ delay: spinning || hasResult ? 0 : index * 0.04, duration: 0.35 }}
                      className={`poster-card group relative block overflow-hidden rounded-xl border text-left transition-shadow disabled:cursor-wait ${
                        isWinner
                          ? "z-10 border-amber-300 shadow-[0_0_28px_rgba(245,197,24,0.5)]"
                          : "border-white/[0.08] hover:border-amber-300/40 hover:shadow-[0_0_22px_rgba(245,197,24,0.22)]"
                      }`}
                    >
                      <div className="relative aspect-[2/3] bg-[#18181b]">
                        <ArtworkImage
                          src={tmdbImage(movie.posterPath, "w342")}
                          fallbackSrc={null}
                          alt={movie.title}
                          title={movie.title}
                          className="h-full w-full object-cover"
                          sizes="160px"
                        />
                        {movie.rating != null && movie.rating > 0 && (
                          <span className="absolute right-1.5 top-1.5 rounded-full border border-white/10 bg-black/70 px-1.5 py-0.5 text-[10px] font-black text-amber-200 backdrop-blur">
                            ★ {movie.rating.toFixed(1)}
                          </span>
                        )}
                        {isWinner && (
                          <span className="absolute left-1/2 top-2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-300 px-2.5 py-1 text-[10px] font-black text-black shadow-lg">
                            🎬 Escolhido!
                          </span>
                        )}
                        <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
                          <span className="mb-3 rounded-full bg-white/15 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white backdrop-blur">
                            Abrir →
                          </span>
                        </div>
                      </div>
                      <div className="p-2.5">
                        <h3 className="truncate text-xs font-extrabold text-white">{movie.title}</h3>
                        <p className="mt-0.5 text-[10px] font-semibold text-slate-500">{movie.year ?? "—"}</p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}

          {!building && pool.length === 0 && (
            <div className="empty-state">
              <p className="text-lg font-bold text-white">Nenhum filme na roleta ainda.</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                Escolha a fonte, ajuste os filtros ao lado e clique em <span className="font-bold text-amber-300">Montar Roleta</span> para buscar os candidatos.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* Cinematic reveal — portaled to <body> so it sits above the sticky header */}
      {mounted && createPortal(
        <AnimatePresence>
        {showReveal && winner && (
          <motion.div
            key="reveal"
            className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowReveal(false)}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
            <motion.div
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 40, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 220, damping: 22 }}
              className="surface relative w-full max-w-3xl overflow-hidden rounded-[2rem] border border-amber-500/30"
            >
              {(() => {
                const detail = winnerDetail;
                const base = winner;
                const backdrop = tmdbImage(detail?.backdropPath ?? base.backdropPath, "w1280");
                const genreText = detail?.genres.length
                  ? detail.genres.join(", ")
                  : base.genreIds.map((id) => genreMap.get(id)).filter(Boolean).join(", ");
                const meta = [
                  detail?.year ?? base.year,
                  detail?.runtime ? `${detail.runtime} min` : null,
                  genreText || null,
                ].filter(Boolean).join(" · ");
                const rating = detail?.rating ?? base.rating;
                return (
                  <>
                    {backdrop && <div className="absolute inset-0 -z-10 bg-cover bg-center opacity-25" style={{ backgroundImage: `url(${backdrop})` }} />}
                    <div className="glass-gradient absolute inset-0 -z-10" />

                    {/* Sparkle burst */}
                    <div className="pointer-events-none absolute left-1/2 top-24 -z-0 h-0 w-0">
                      {Array.from({ length: 12 }).map((_, i) => {
                        const angle = (i / 12) * Math.PI * 2;
                        return (
                          <motion.span
                            key={i}
                            className="absolute h-1.5 w-1.5 rounded-full bg-amber-300"
                            initial={{ opacity: 0.9, x: 0, y: 0, scale: 1 }}
                            animate={{ opacity: 0, x: Math.cos(angle) * 150, y: Math.sin(angle) * 150, scale: 0.2 }}
                            transition={{ duration: 0.9, ease: "easeOut", delay: 0.05 }}
                          />
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowReveal(false)}
                      aria-label="Fechar"
                      className="icon-button absolute right-4 top-4 z-10 h-9 w-9 text-lg"
                    >
                      ×
                    </button>

                    <div className="grid gap-6 p-6 sm:grid-cols-[12rem_1fr] sm:p-8">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.85, rotate: -4 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 200, damping: 18, delay: 0.08 }}
                        className="mx-auto aspect-[2/3] w-full max-w-[12rem] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#18181b] shadow-[0_20px_60px_rgba(0,0,0,.55)]"
                      >
                        <ArtworkImage src={tmdbImage(detail?.posterPath ?? base.posterPath, "w342")} fallbackSrc={null} alt={base.title} title={base.title} className="h-full w-full object-cover" sizes="192px" />
                      </motion.div>
                      <div className="space-y-4">
                        <div>
                          <motion.span
                            className="eyebrow !text-amber-300"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.12 }}
                          >
                            🎉 A roleta escolheu
                          </motion.span>
                          <motion.h2
                            className="display-title mt-1 text-3xl leading-tight sm:text-4xl"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.16 }}
                          >
                            {detail?.title ?? base.title}
                          </motion.h2>
                          {meta && <p className="mt-2 text-sm font-bold text-slate-400">{meta}</p>}
                        </div>
                        {rating != null && rating > 0 && (
                          <p className="text-sm font-bold text-amber-200">
                            ★ {rating.toFixed(1)} <span className="text-slate-500">/ 10 · TMDB</span>
                          </p>
                        )}
                        {base.rationale && (
                          <motion.p
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="rounded-xl border border-amber-300/25 bg-amber-300/[0.08] p-3 text-sm leading-6 text-amber-100"
                          >
                            💡 {base.rationale}
                          </motion.p>
                        )}
                        <p className="line-clamp-4 text-sm leading-6 text-slate-300">
                          {detailLoading ? "Carregando sinopse…" : detail?.overview ?? base.overview ?? "Sinopse indisponível em português."}
                        </p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <button onClick={() => openMovie(base)} disabled={openingId === base.id} className="accent-button px-5 py-2.5 text-sm disabled:opacity-60">
                            {openingId === base.id ? "Abrindo…" : "Abrir filme →"}
                          </button>
                          <button onClick={() => addToWatchlist(base)} disabled={savingWatchlist} className="quiet-button px-4 py-2.5 text-sm disabled:opacity-60">
                            {savingWatchlist ? "Salvando…" : "＋ Watchlist"}
                          </button>
                          <button onClick={spin} disabled={spinning} className="quiet-button px-4 py-2.5 text-sm disabled:opacity-50">Girar de novo 🎲</button>
                          <button onClick={resetAll} className="quiet-button px-4 py-2.5 text-sm">Nova busca</button>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
        </AnimatePresence>,
        document.body,
      )}
    </main>
  );
}
