"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
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
};
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

  // Filter state
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenreIds, setSelectedGenreIds] = useState<number[]>([]);
  const [peopleQuery, setPeopleQuery] = useState("");
  const [peopleResults, setPeopleResults] = useState<Person[]>([]);
  const [selectedPeople, setSelectedPeople] = useState<Person[]>([]);
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [runtimeMax, setRuntimeMax] = useState(RUNTIME_MAX);
  const [count, setCount] = useState(8);

  // Roulette state
  const [pool, setPool] = useState<PoolMovie[]>([]);
  const [building, setBuilding] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [winnerIndex, setWinnerIndex] = useState(-1);
  const [winnerDetail, setWinnerDetail] = useState<WinnerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const genreMap = new Map(genres.map((g) => [g.id, g.name]));

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
    setSelectedGenreIds([]);
    setSelectedPeople([]);
    setPeopleQuery("");
    setPeopleResults([]);
    setYearFrom("");
    setYearTo("");
    setRuntimeMax(RUNTIME_MAX);
    setCount(8);
    setPool([]);
    setActiveIndex(-1);
    setWinnerIndex(-1);
    setWinnerDetail(null);
  };

  const buildPool = async () => {
    setBuilding(true);
    setPool([]);
    setActiveIndex(-1);
    setWinnerIndex(-1);
    setWinnerDetail(null);
    try {
      const params = new URLSearchParams();
      if (selectedGenreIds.length) params.set("genres", selectedGenreIds.join(","));
      if (selectedPeople.length) params.set("people", selectedPeople.map((p) => p.id).join(","));
      if (yearFrom) params.set("yearFrom", yearFrom);
      if (yearTo) params.set("yearTo", yearTo);
      if (runtimeMax < RUNTIME_MAX) params.set("runtimeMax", String(runtimeMax));
      params.set("count", String(count));

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
      /* the pool card already shows the essentials */
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const spinTimer = useRef<number | null>(null);

  const spin = useCallback(() => {
    if (pool.length === 0 || spinning) return;
    setSpinning(true);
    setWinnerIndex(-1);
    setWinnerDetail(null);

    const target = randomIndex(pool.length);
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion || pool.length === 1) {
      setActiveIndex(target);
      setWinnerIndex(target);
      setSpinning(false);
      void fetchWinnerDetail(pool[target].id);
      return;
    }

    // Sweep the highlight ~2.5s: fast at first, decelerating, landing on `target`.
    let currentIndex = 0;
    let tick = 0;
    const baseLoops = 3; // full passes before it's allowed to stop
    const totalTicks = baseLoops * pool.length + target;

    const step = () => {
      setActiveIndex(currentIndex);

      if (tick >= totalTicks) {
        setWinnerIndex(target);
        setSpinning(false);
        void fetchWinnerDetail(pool[target].id);
        return;
      }

      currentIndex = (currentIndex + 1) % pool.length;
      tick += 1;

      const remaining = totalTicks - tick;
      // ease-out: accelerate the delay as we approach the end
      const delay = remaining > 12 ? 70 : remaining > 6 ? 70 + (12 - remaining) * 22 : 200 + (6 - remaining) * 45;
      spinTimer.current = window.setTimeout(step, delay);
    };

    step();
  }, [pool, spinning, fetchWinnerDetail]);

  useEffect(() => () => {
    if (spinTimer.current) window.clearTimeout(spinTimer.current);
  }, []);

  const hasResult = winnerIndex >= 0 && !spinning;
  const filtersDisabled = building || spinning;

  return (
    <main className="page-shell max-w-6xl space-y-10">
      <header>
        <p className="eyebrow">Assistente de Seleção</p>
        <h1 className="display-title mt-3 text-5xl sm:text-7xl">Roleta de Filmes.</h1>
        <p className="mt-4 max-w-2xl leading-7 text-slate-400">
          Não sabe o que assistir? Defina seus filtros e deixe a roleta decidir por você.
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

            {/* People */}
            <div className="space-y-2">
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

            {/* Runtime */}
            <div className="space-y-2">
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
                  ? `${pool.length} filmes no sorteio`
                  : "Monte a roleta para começar."}
            </p>
            {pool.length > 0 && (
              <button onClick={spin} disabled={spinning} className="accent-button font-black disabled:cursor-not-allowed disabled:opacity-50">
                {spinning ? "Sorteando…" : "Girar 🎲"}
              </button>
            )}
          </div>

          {building && (
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(130px,1fr))] sm:[grid-template-columns:repeat(auto-fill,minmax(160px,1fr))]">
              {Array.from({ length: count }).map((_, index) => (
                <div key={index} className="shimmer aspect-[2/3] rounded-xl" />
              ))}
            </div>
          )}

          {!building && pool.length > 0 && (
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(130px,1fr))] sm:[grid-template-columns:repeat(auto-fill,minmax(160px,1fr))]">
              {pool.map((movie, index) => {
                const active = activeIndex === index && spinning;
                const isWinner = hasResult && winnerIndex === index;
                return (
                  <motion.div
                    key={`${movie.id}-${index}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{
                      opacity: hasResult && !isWinner ? 0.45 : 1,
                      y: 0,
                      scale: isWinner ? 1.12 : active ? 1.05 : 1,
                    }}
                    transition={{ delay: spinning || hasResult ? 0 : index * 0.05, duration: 0.35 }}
                    className={`relative overflow-hidden rounded-xl border transition-shadow ${
                      isWinner
                        ? "z-10 border-amber-300 shadow-[0_0_28px_rgba(245,197,24,0.6)]"
                        : active
                          ? "z-10 border-amber-300 shadow-[0_0_18px_rgba(245,197,24,0.45)]"
                          : "border-white/[0.08] hover:shadow-[0_0_22px_rgba(245,197,24,0.25)]"
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
                    </div>
                    <div className="p-2.5">
                      <h3 className="truncate text-xs font-extrabold text-white">{movie.title}</h3>
                      <p className="mt-0.5 text-[10px] font-semibold text-slate-500">{movie.year ?? "—"}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {!building && pool.length === 0 && (
            <div className="empty-state">
              <p className="text-lg font-bold text-white">Nenhum filme no sorteio ainda.</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                Ajuste os filtros ao lado e clique em <span className="font-bold text-amber-300">Montar Roleta</span> para buscar títulos no catálogo do TMDB.
              </p>
            </div>
          )}

          {/* Winner detail */}
          <AnimatePresence>
            {hasResult && pool[winnerIndex] && (
              <motion.div
                key="winner"
                initial={{ opacity: 0, y: 32 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{ type: "spring", stiffness: 200, damping: 24 }}
                className="surface relative overflow-hidden rounded-[2rem] border border-amber-500/25"
              >
                {(() => {
                  const detail = winnerDetail;
                  const base = pool[winnerIndex];
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
                      {backdrop && (
                        <div className="absolute inset-0 -z-10 bg-cover bg-center opacity-25" style={{ backgroundImage: `url(${backdrop})` }} />
                      )}
                      <div className="glass-gradient absolute inset-0 -z-10" />
                      <div className="grid gap-6 p-6 sm:grid-cols-[11rem_1fr] sm:p-8">
                        <div className="mx-auto aspect-[2/3] w-full max-w-[11rem] overflow-hidden rounded-xl border border-white/[0.08] bg-[#18181b]">
                          <ArtworkImage src={tmdbImage(detail?.posterPath ?? base.posterPath, "w342")} fallbackSrc={null} alt={base.title} title={base.title} className="h-full w-full object-cover" sizes="176px" />
                        </div>
                        <div className="space-y-4">
                          <div>
                            <span className="eyebrow !text-amber-300">Filme sorteado</span>
                            <h2 className="mt-1 text-3xl font-black text-white">{detail?.title ?? base.title}</h2>
                            {meta && <p className="mt-1 text-sm font-bold text-slate-400">{meta}</p>}
                          </div>
                          {rating != null && rating > 0 && (
                            <p className="text-sm font-bold text-amber-200">★ {rating.toFixed(1)} <span className="text-slate-500">/ 10 · TMDB</span></p>
                          )}
                          <p className="line-clamp-4 text-sm leading-6 text-slate-300">
                            {detailLoading ? "Carregando sinopse…" : detail?.overview ?? base.overview ?? "Sinopse indisponível em português."}
                          </p>
                          <div className="flex flex-wrap gap-2 pt-1">
                            <button onClick={spin} disabled={spinning} className="quiet-button px-4 py-2 text-xs disabled:opacity-50">Girar Novamente</button>
                            <button onClick={resetAll} className="quiet-button px-4 py-2 text-xs">Nova Busca</button>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
    </main>
  );
}
