"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ArtworkImage from "@/components/ArtworkImage";
import { useToast } from "@/components/ToastProvider";
import {
  computeHybridScore,
  HINT_KEYWORDS_AT,
  HINT_TAGLINE_AT,
  MAX_GUESSES,
  type GuessTiles,
  type PosterStage,
} from "@/lib/play/hybrid";

type Source = "mine" | "popular" | "daily";
type Phase = "menu" | "playing" | "over";

type Actor = { name: string; profilePath: string | null };
type Suggestion = { tmdbId: number; title: string; year: number | null };
type Answer = {
  tmdbId: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  directorName: string | null;
  genres: string[];
  cast: string[];
  tagline: string | null;
};
type Row = { tmdbId: number; title: string; year: number | null; tiles: GuessTiles };
type NextClues = {
  actor: Actor | null;
  poster: { path: string | null; stage: PosterStage } | null;
  hints: { keywords: boolean; tagline: boolean };
};
type Outcome = { solved: boolean; answer: Answer; guessesUsed: number; score: number; improved: boolean | null };

const SOURCES: Array<{ id: Source; label: string; hint: string }> = [
  { id: "mine", label: "Meus filmes", hint: "só títulos do seu arquivo" },
  { id: "popular", label: "Populares (TMDB)", hint: "o catálogo global" },
  { id: "daily", label: "Filme do dia", hint: "o mesmo desafio para todo mundo, um por dia" },
];

const TILE_META = {
  year: { label: "Ano" },
  genres: { label: "Gêneros" },
  director: { label: "Direção" },
  studio: { label: "Estúdio" },
  rating: { label: "Nota" },
  cast: { label: "Elenco" },
} as const;

function image(path: string | null, size: "w185" | "w342"): string | null {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path.startsWith("/") ? path : `/${path}`}`;
}

const POSTER_BLUR: Record<PosterStage, string> = {
  hidden: "",
  heavy: "blur-2xl scale-110",
  medium: "blur-lg scale-105",
  light: "blur-[3px] scale-[1.02]",
};

const GRADE_CLASS: Record<GuessTiles[keyof GuessTiles]["grade"], string> = {
  exact: "border-emerald-300/60 bg-emerald-400/15 text-emerald-100",
  close: "border-amber-300/60 bg-amber-300/15 text-amber-100",
  miss: "border-white/[0.08] bg-white/[0.03] text-slate-500",
};

const GRADE_WORD = { exact: "exato", close: "perto", miss: "longe" } as const;

function arrowFor(direction: "target-higher" | "target-lower" | null): string {
  return direction === "target-higher" ? " ↑" : direction === "target-lower" ? " ↓" : "";
}

/** One comparison tile: color carries the grade, text carries it too (a11y). */
function Tile({ label, grade, text, detail }: { label: string; grade: keyof typeof GRADE_WORD; text: string; detail?: string }) {
  const description = `${label}: ${text} — ${GRADE_WORD[grade]}${detail ? `; ${detail}` : ""}`;
  return (
    <div
      aria-label={description}
      title={description}
      className={`min-w-0 rounded-xl border px-2 py-1.5 text-center ${GRADE_CLASS[grade]}`}
    >
      <p className="text-[8px] font-black uppercase tracking-wider opacity-60">{label}</p>
      <p className="truncate text-[11px] font-black leading-4">{text}</p>
    </div>
  );
}

function tileTexts(tiles: GuessTiles) {
  return {
    year: { text: `${tiles.year.guessYear ?? "—"}${arrowFor(tiles.year.direction)}`, detail: tiles.year.direction ? (tiles.year.direction === "target-higher" ? "o alvo é mais recente" : "o alvo é mais antigo") : undefined },
    genres: { text: tiles.genres.shared.length ? tiles.genres.shared.join(", ") : tiles.genres.guessGenres.slice(0, 2).join(", ") || "—", detail: tiles.genres.shared.length ? `${tiles.genres.shared.length} em comum` : "nenhum em comum" },
    director: { text: tiles.director.guessDirector ?? "—" },
    studio: { text: tiles.studio.shared[0] ?? tiles.studio.guessStudio ?? "—", detail: tiles.studio.shared.length ? "estúdio em comum" : undefined },
    rating: { text: `${tiles.rating.guessRating != null ? tiles.rating.guessRating.toFixed(1) : "—"}${arrowFor(tiles.rating.direction)}`, detail: tiles.rating.direction ? (tiles.rating.direction === "target-higher" ? "a nota do alvo é maior" : "a nota do alvo é menor") : undefined },
    cast: { text: tiles.cast.shared.length ? tiles.cast.shared.join(", ") : "0 em comum", detail: `${tiles.cast.shared.length} ator(es) em comum` },
  };
}

export default function HybridGame({ initialBest }: { initialBest: Partial<Record<Source, number>> }) {
  const { notify } = useToast();

  const [phase, setPhase] = useState<Phase>("menu");
  const [source, setSource] = useState<Source>("mine");
  const [best, setBest] = useState(initialBest);
  const [playedIds, setPlayedIds] = useState<number[]>([]);

  // Round state — everything the server has revealed so far.
  const [token, setToken] = useState("");
  const [castTotal, setCastTotal] = useState(0);
  const [actors, setActors] = useState<Actor[]>([]);
  const [poster, setPoster] = useState<{ path: string | null; stage: PosterStage } | null>(null);
  const [hintGates, setHintGates] = useState({ keywords: false, tagline: false });
  const [keywords, setKeywords] = useState<string[] | null>(null);
  const [tagline, setTagline] = useState<string | null>(null);
  const [guessNumber, setGuessNumber] = useState(1);
  const [rows, setRows] = useState<Row[]>([]);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const [guess, setGuess] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingRound, setLoadingRound] = useState(false);
  const [shake, setShake] = useState(0);

  const hintsUsed = (keywords ? 1 : 0) + (tagline !== null ? 1 : 0);

  // Debounced autocomplete for the guess box.
  useEffect(() => {
    const query = guess.trim();
    if (phase !== "playing" || outcome || query.length < 2) {
      setSuggestions([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/play/search?q=${encodeURIComponent(query)}&source=${source}`);
        const data = await res.json();
        if (res.ok) setSuggestions(data.suggestions ?? []);
      } catch {
        /* best-effort */
      }
    }, 300);
    return () => window.clearTimeout(handle);
  }, [guess, phase, outcome, source]);

  const finish = useCallback(async (solved: boolean, answer: Answer, guessesUsed: number, usedHints: number, currentSource: Source) => {
    const score = computeHybridScore({ solved, guessesUsed, hintsUsed: usedHints });
    setOutcome({ solved, answer, guessesUsed, score, improved: null });
    setPhase("over");
    setPlayedIds((current) => [...current, answer.tmdbId].slice(-40));
    try {
      const res = await fetch("/api/play/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: currentSource, score, rounds: guessesUsed }),
      });
      const data = await res.json();
      if (res.ok) {
        setOutcome((current) => (current ? { ...current, improved: Boolean(data.improved) } : current));
        setBest((current) => ({ ...current, [currentSource]: data.bestScore }));
      }
    } catch {
      /* score persistence is best-effort */
    }
  }, []);

  const start = useCallback(async (chosen: Source) => {
    setSource(chosen);
    setLoadingRound(true);
    setPhase("playing");
    setOutcome(null);
    setRows([]);
    setGuess("");
    setSuggestions([]);
    setKeywords(null);
    setTagline(null);
    setPoster(null);
    setHintGates({ keywords: false, tagline: false });
    setGuessNumber(1);
    try {
      const res = await fetch("/api/play/round", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: chosen, excludeIds: chosen === "daily" ? [] : playedIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível montar a rodada.");
      setToken(data.token);
      setCastTotal(data.castTotal);
      setActors(data.actors ?? []);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível montar a rodada.", "error");
      setPhase("menu");
    } finally {
      setLoadingRound(false);
    }
  }, [notify, playedIds]);

  const submitGuess = useCallback(async (pick: Suggestion) => {
    if (busy || outcome) return;
    if (rows.some((row) => row.tmdbId === pick.tmdbId)) {
      notify("Você já tentou esse filme.", "info");
      return;
    }
    setBusy(true);
    setSuggestions([]);
    setGuess("");
    try {
      const res = await fetch("/api/play/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "guess", tmdbId: pick.tmdbId, guessNumber }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao validar o palpite.");

      const row: Row = { tmdbId: pick.tmdbId, title: data.guess.title, year: data.guess.year, tiles: data.tiles };
      setRows((current) => [...current, row]);

      if (data.correct) {
        await finish(true, data.answer, guessNumber, hintsUsed, source);
        return;
      }
      if (data.gameOver) {
        await finish(false, data.answer, guessNumber, hintsUsed, source);
        return;
      }
      setShake((count) => count + 1);
      const next: NextClues = data.next;
      if (next.actor) setActors((current) => [...current, next.actor as Actor]);
      if (next.poster) setPoster(next.poster);
      setHintGates(next.hints);
      setGuessNumber((current) => current + 1);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Falha ao validar o palpite.", "error");
    } finally {
      setBusy(false);
    }
  }, [busy, outcome, rows, token, guessNumber, hintsUsed, source, finish, notify]);

  const askHint = useCallback(async (hint: 1 | 2) => {
    if (busy || outcome) return;
    if (hint === 1 && keywords) return;
    if (hint === 2 && tagline !== null) return;
    setBusy(true);
    try {
      const res = await fetch("/api/play/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "hint", hint, guessNumber }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "A dica não veio.");
      if (hint === 1) setKeywords(data.keywords ?? []);
      else setTagline(data.tagline ?? "");
    } catch (error) {
      notify(error instanceof Error ? error.message : "A dica não veio.", "error");
    } finally {
      setBusy(false);
    }
  }, [busy, outcome, keywords, tagline, token, guessNumber, notify]);

  const giveUp = useCallback(async () => {
    if (busy || outcome) return;
    setBusy(true);
    try {
      const res = await fetch("/api/play/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "giveup", guessNumber }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha na rodada.");
      await finish(false, data.answer, guessNumber, hintsUsed, source);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Falha na rodada.", "error");
      setPhase("menu");
    } finally {
      setBusy(false);
    }
  }, [busy, outcome, token, guessNumber, hintsUsed, source, finish, notify]);

  const sourceLabel = useMemo(() => SOURCES.find((option) => option.id === source)?.label, [source]);

  // ------------------------------------------------------------------ menu

  if (phase === "menu") {
    return (
      <section className="grid gap-4 sm:grid-cols-3">
        {SOURCES.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => start(option.id)}
            className="surface group rounded-[2rem] p-7 text-left transition hover:border-amber-300/40"
          >
            <p className="eyebrow">{option.id === "daily" ? "Desafio diário" : "Fonte"}</p>
            <h2 className="section-heading mt-2 group-hover:text-amber-100">{option.label}</h2>
            <p className="mt-2 text-sm text-slate-400">{option.hint}</p>
            <p className="mt-6 text-xs font-black uppercase tracking-wider text-slate-600">
              Recorde: <span className="text-amber-200">{best[option.id] ?? "—"}</span>
            </p>
            <span className="accent-button mt-5 inline-flex px-5 py-2.5 text-sm">Jogar →</span>
          </button>
        ))}
      </section>
    );
  }

  // ------------------------------------------------------------------ over

  if (phase === "over" && outcome) {
    return (
      <section className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 22 }}
          className={`surface relative overflow-hidden rounded-[2rem] border p-6 sm:p-8 ${outcome.solved ? "border-amber-300/50" : "border-white/[0.08]"}`}
        >
          {outcome.solved && (
            <div inert className="pointer-events-none absolute left-1/2 top-16 h-0 w-0">
              {Array.from({ length: 12 }).map((_, index) => {
                const angle = (index / 12) * Math.PI * 2;
                return (
                  <motion.span
                    key={index}
                    className="absolute h-1.5 w-1.5 rounded-full bg-amber-300"
                    initial={{ opacity: 0.9, x: 0, y: 0, scale: 1 }}
                    animate={{ opacity: 0, x: Math.cos(angle) * 140, y: Math.sin(angle) * 140, scale: 0.2 }}
                    transition={{ duration: 0.9, ease: "easeOut" }}
                  />
                );
              })}
            </div>
          )}
          <div className="grid gap-6 sm:grid-cols-[9rem_1fr]">
            <motion.div
              initial={{ opacity: 0, scale: 0.85, rotate: -4 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 18, delay: 0.06 }}
              className="artwork-frame mx-auto aspect-[2/3] w-36 rounded-xl"
            >
              <ArtworkImage src={image(outcome.answer.posterPath, "w342")} alt={outcome.answer.title} title={outcome.answer.title} className="h-full w-full" sizes="144px" />
            </motion.div>
            <div>
              <p className={`eyebrow ${outcome.solved ? "!text-amber-300" : "!text-slate-500"}`}>
                {outcome.solved ? `🎉 Acertou no palpite ${outcome.guessesUsed}!` : "A resposta era"}
              </p>
              <h2 className="display-title mt-1 text-3xl sm:text-4xl">
                {outcome.answer.title} {outcome.answer.year ? <span className="text-slate-500">({outcome.answer.year})</span> : null}
              </h2>
              {outcome.answer.tagline && <p className="mt-2 text-sm italic text-slate-400">“{outcome.answer.tagline}”</p>}
              <p className="mt-3 text-sm text-slate-400">
                {[outcome.answer.directorName ? `Direção: ${outcome.answer.directorName}` : null, outcome.answer.genres.join(", ") || null].filter(Boolean).join(" · ")}
              </p>
              <p className="mt-1 text-sm text-slate-500">Elenco: {outcome.answer.cast.join(", ")}</p>
              <p className="mt-4 text-2xl font-black tabular-nums text-amber-200">
                {outcome.score} pontos
                {outcome.improved ? <span className="ml-2 text-sm">🎉 novo recorde!</span> : null}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {source === "daily" ? (
                  <span className="quiet-button cursor-default px-5 py-2.5 text-sm">Volte amanhã para o próximo 🍿</span>
                ) : (
                  <button type="button" onClick={() => start(source)} className="accent-button px-5 py-2.5 text-sm">Jogar de novo</button>
                )}
                <button type="button" onClick={() => setPhase("menu")} className="quiet-button px-5 py-2.5 text-sm">Trocar fonte</button>
              </div>
            </div>
          </div>
        </motion.div>

        {rows.length > 0 && <GuessBoard rows={rows} />}
      </section>
    );
  }

  // --------------------------------------------------------------- playing

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-black text-white">
          Palpite <span className="text-amber-200">{guessNumber}</span> / {MAX_GUESSES}
          <span className="ml-3 text-xs font-bold text-slate-500">{sourceLabel}</span>
        </p>
        <p className="text-xs font-bold text-slate-500">
          🟩 exato · 🟨 perto · ⬜ longe
        </p>
      </div>

      {loadingRound ? (
        <div className="surface skeleton-bg h-96 rounded-[2rem]" />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[19rem_1fr]">
          {/* Identity clues: actors one by one, poster from guess 7. */}
          <aside className="surface h-fit space-y-5 rounded-[2rem] p-5 sm:p-6">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">
                Elenco <span className="text-amber-300">{actors.length}</span> / {castTotal}
                <span className="ml-2 normal-case text-slate-600">— do coadjuvante ao protagonista</span>
              </p>
              <ul className="mt-3 space-y-2">
                <AnimatePresence initial={false}>
                  {actors.map((actor, index) => (
                    <motion.li
                      key={actor.name}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ type: "spring", stiffness: 260, damping: 22 }}
                      className={`flex items-center gap-3 rounded-2xl border p-2 ${index === actors.length - 1 ? "border-amber-300/40 bg-amber-300/[0.07]" : "border-white/[0.07] bg-white/[0.03]"}`}
                    >
                      <span className="artwork-frame h-12 w-12 shrink-0 overflow-hidden rounded-full">
                        <ArtworkImage src={image(actor.profilePath, "w185")} alt={actor.name} title={actor.name} className="h-full w-full object-cover" sizes="48px" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-black text-white">{actor.name}</span>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </div>

            {/* Poster: hidden → heavy → medium → light blur (schedule-driven). */}
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">Pôster</p>
              <div className="artwork-frame relative mx-auto mt-3 aspect-[2/3] w-40 overflow-hidden rounded-xl bg-[#18181b]">
                {poster?.path ? (
                  <>
                    <ArtworkImage
                      src={image(poster.path, "w342")}
                      alt="Pôster desfocado do filme misterioso"
                      title="Pôster do filme misterioso"
                      className={`h-full w-full object-cover transition-all duration-700 ${POSTER_BLUR[poster.stage]}`}
                      sizes="160px"
                    />
                    <div inert className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                  </>
                ) : (
                  <div className="grid h-full w-full place-items-center text-4xl font-black text-slate-700">?</div>
                )}
              </div>
              {!poster?.path && <p className="mt-2 text-center text-[10px] font-bold text-slate-600">revela no palpite 7</p>}
            </div>

            {/* Optional hints (5 and 8); using one costs score bonus. */}
            <div className="space-y-2">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">Dicas opcionais <span className="normal-case text-slate-600">— custam bônus</span></p>
              {keywords ? (
                <p className="rounded-xl border border-amber-300/25 bg-amber-300/[0.07] px-3 py-2 text-xs font-bold text-amber-100">💡 Temas: {keywords.length ? keywords.join(", ") : "sem palavras-chave no TMDB"}</p>
              ) : (
                <button type="button" onClick={() => askHint(1)} disabled={busy || !hintGates.keywords} className="quiet-button w-full justify-center px-3 py-2 text-xs disabled:opacity-40">
                  💡 Palavras-chave {hintGates.keywords ? "" : `(palpite ${HINT_KEYWORDS_AT})`}
                </button>
              )}
              {tagline !== null ? (
                <p className="rounded-xl border border-amber-300/25 bg-amber-300/[0.07] px-3 py-2 text-xs font-bold text-amber-100">💡 Tagline: {tagline || "sem tagline no TMDB"}</p>
              ) : (
                <button type="button" onClick={() => askHint(2)} disabled={busy || !hintGates.tagline} className="quiet-button w-full justify-center px-3 py-2 text-xs disabled:opacity-40">
                  💡 Tagline {hintGates.tagline ? "" : `(palpite ${HINT_TAGLINE_AT})`}
                </button>
              )}
            </div>
          </aside>

          {/* Guess input + comparison board. */}
          <div className="space-y-4">
            <motion.div key={shake} animate={shake ? { x: [0, -10, 10, -6, 6, 0] } : undefined} transition={{ duration: 0.4 }} className="relative">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (suggestions[0]) void submitGuess(suggestions[0]);
                }}
                className="flex gap-2"
              >
                <input
                  value={guess}
                  onChange={(event) => setGuess(event.target.value)}
                  placeholder="Que filme é esse? Escolha das sugestões…"
                  className="field flex-1"
                  autoComplete="off"
                  autoFocus
                />
                <button type="submit" disabled={busy || !suggestions.length} className="accent-button px-5 text-sm font-black disabled:opacity-50">
                  Chutar
                </button>
              </form>
              {suggestions.length > 0 && (
                <ul className="surface-raised absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-white/10 p-1">
                  {suggestions.map((suggestion) => (
                    <li key={suggestion.tmdbId}>
                      <button
                        type="button"
                        onClick={() => void submitGuess(suggestion)}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm font-bold text-white hover:bg-white/[0.06]"
                      >
                        {suggestion.title} <span className="text-xs text-slate-500">{suggestion.year ?? ""}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>

            {rows.length ? (
              <GuessBoard rows={rows} />
            ) : (
              <div className="empty-state !py-10">
                <p className="text-sm font-bold text-white">Um ator já está na mesa — chute um filme.</p>
                <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-slate-500">
                  Cada palpite compara ano, gêneros, direção, estúdio, nota e elenco com o filme misterioso — e revela mais uma pista.
                </p>
              </div>
            )}

            <div className="flex justify-end">
              <button type="button" onClick={() => void giveUp()} disabled={busy} className="quiet-button px-4 py-2 text-xs text-slate-500 disabled:opacity-40">
                Desistir e revelar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/** The Spotle-style board: one row per guess, six graded tiles. */
function GuessBoard({ rows }: { rows: Row[] }) {
  return (
    <ol className="space-y-2">
      {rows.map((row, index) => {
        const texts = tileTexts(row.tiles);
        return (
          <motion.li
            key={`${row.tmdbId}-${index}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 24 }}
            className="surface-subtle rounded-2xl p-3"
          >
            <p className="truncate px-1 text-xs font-black text-white">
              {index + 1}. {row.title} {row.year ? <span className="text-slate-500">({row.year})</span> : null}
            </p>
            <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
              {(Object.keys(TILE_META) as Array<keyof typeof TILE_META>).map((tileKey) => (
                <Tile
                  key={tileKey}
                  label={TILE_META[tileKey].label}
                  grade={row.tiles[tileKey].grade}
                  text={texts[tileKey].text}
                  detail={"detail" in texts[tileKey] ? (texts[tileKey] as { detail?: string }).detail : undefined}
                />
              ))}
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
