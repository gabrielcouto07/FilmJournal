"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ArtworkImage from "@/components/ArtworkImage";
import { useToast } from "@/components/ToastProvider";
import { computeRoundScore, MAX_REVEALS, ROUND_MS, ROUNDS_PER_RUN } from "@/lib/play/scoring";

type Source = "mine" | "popular";
type Phase = "menu" | "playing" | "summary";

type Answer = { tmdbId: number; title: string; year: number | null; posterPath: string | null; cast: string[] };
type RoundResult = { answer: Answer; solved: boolean; reveals: number; score: number };
type Suggestion = { title: string; year: number | null };

const SOURCES: Array<{ id: Source; label: string; hint: string }> = [
  { id: "mine", label: "Meus filmes", hint: "só títulos do seu arquivo" },
  { id: "popular", label: "Populares (TMDB)", hint: "o catálogo global" },
];

function posterUrl(path: string | null): string | null {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/w342${path.startsWith("/") ? path : `/${path}`}`;
}

export default function CastQuizGame({ initialBest }: { initialBest: Partial<Record<Source, number>> }) {
  const { notify } = useToast();

  const [phase, setPhase] = useState<Phase>("menu");
  const [source, setSource] = useState<Source>("mine");
  const [best, setBest] = useState(initialBest);

  // Round state
  const [roundNumber, setRoundNumber] = useState(1);
  const [token, setToken] = useState("");
  const [cast, setCast] = useState<string[]>([]);
  const [totalCast, setTotalCast] = useState(MAX_REVEALS);
  const [guess, setGuess] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingRound, setLoadingRound] = useState(false);
  const [shake, setShake] = useState(0);
  const [roundOver, setRoundOver] = useState<RoundResult | null>(null);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [improved, setImproved] = useState(false);

  // Timer
  const [now, setNow] = useState(0);
  const roundStartRef = useRef(0);
  const timedOutRef = useRef(false);

  const elapsed = roundStartRef.current ? Math.max(0, now - roundStartRef.current) : 0;
  const remaining = Math.max(0, ROUND_MS - elapsed);

  const finishRound = useCallback((solved: boolean, answer: Answer, reveals: number) => {
    const elapsedMs = Math.max(0, Date.now() - roundStartRef.current);
    const score = computeRoundScore({ solved, revealedCount: reveals, elapsedMs });
    roundStartRef.current = 0;
    setRoundOver({ answer, solved, reveals, score });
  }, []);

  const giveUp = useCallback(async (currentToken: string, reveals: number) => {
    try {
      const res = await fetch("/api/play/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: currentToken, action: "giveup", revealed: reveals }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha na rodada.");
      finishRound(false, data.answer, reveals);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Falha na rodada.", "error");
      setPhase("menu");
    }
  }, [finishRound, notify]);

  // Round countdown; expiry surrenders the round automatically.
  useEffect(() => {
    if (phase !== "playing" || roundOver || !token) return;
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [phase, roundOver, token]);

  useEffect(() => {
    if (phase !== "playing" || roundOver || !token || !roundStartRef.current) return;
    if (remaining <= 0 && !timedOutRef.current) {
      timedOutRef.current = true;
      void giveUp(token, cast.length);
    }
  }, [remaining, phase, roundOver, token, cast.length, giveUp]);

  // Debounced autocomplete for the guess box.
  useEffect(() => {
    const query = guess.trim();
    if (phase !== "playing" || roundOver || query.length < 2) {
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
  }, [guess, phase, roundOver, source]);

  const startRound = useCallback(async (nextSource: Source, excludeIds: number[]) => {
    setLoadingRound(true);
    setRoundOver(null);
    setGuess("");
    setSuggestions([]);
    timedOutRef.current = false;
    try {
      const res = await fetch("/api/play/round", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: nextSource, excludeIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível montar a rodada.");
      setToken(data.token);
      setCast([data.firstCast]);
      setTotalCast(data.totalCast);
      roundStartRef.current = Date.now();
      setNow(Date.now());
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível montar a rodada.", "error");
      setPhase(results.length ? "summary" : "menu");
    } finally {
      setLoadingRound(false);
    }
  }, [notify, results.length]);

  const startRun = useCallback(async (chosen: Source) => {
    setSource(chosen);
    setResults([]);
    setRoundNumber(1);
    setImproved(false);
    setPhase("playing");
    await startRound(chosen, []);
  }, [startRound]);

  const submitGuess = useCallback(async (value?: string) => {
    const attempt = (value ?? guess).trim();
    if (!attempt || busy || roundOver) return;
    setBusy(true);
    setSuggestions([]);
    try {
      const res = await fetch("/api/play/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "guess", guess: attempt, revealed: cast.length }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao validar o palpite.");
      if (data.correct) {
        finishRound(true, data.answer, cast.length);
      } else {
        setShake((count) => count + 1);
        setGuess("");
        if (data.nextCast) setCast((current) => [...current, data.nextCast]);
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "Falha ao validar o palpite.", "error");
    } finally {
      setBusy(false);
    }
  }, [guess, busy, roundOver, token, cast.length, finishRound, notify]);

  const askHint = useCallback(async () => {
    if (busy || roundOver || cast.length >= totalCast) return;
    setBusy(true);
    try {
      const res = await fetch("/api/play/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "hint", revealed: cast.length }),
      });
      const data = await res.json();
      if (res.ok && data.nextCast) setCast((current) => [...current, data.nextCast]);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }, [busy, roundOver, token, cast.length, totalCast]);

  const nextRound = useCallback(async () => {
    if (!roundOver) return;
    const allResults = [...results, roundOver];
    setResults(allResults);
    if (roundNumber >= ROUNDS_PER_RUN) {
      const total = allResults.reduce((sum, result) => sum + result.score, 0);
      setPhase("summary");
      try {
        const res = await fetch("/api/play/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source, score: total, rounds: ROUNDS_PER_RUN }),
        });
        const data = await res.json();
        if (res.ok) {
          setImproved(Boolean(data.improved));
          setBest((current) => ({ ...current, [source]: data.bestScore }));
        }
      } catch {
        /* score persistence is best-effort */
      }
      return;
    }
    setRoundNumber(roundNumber + 1);
    await startRound(source, allResults.map((result) => result.answer.tmdbId));
  }, [roundOver, results, roundNumber, source, startRound]);

  const totalScore = results.reduce((sum, result) => sum + result.score, 0) + (roundOver?.score ?? 0);

  // ------------------------------------------------------------------ menu

  if (phase === "menu") {
    return (
      <section className="grid gap-4 sm:grid-cols-2">
        {SOURCES.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => startRun(option.id)}
            className="surface group rounded-[2rem] p-8 text-left transition hover:border-amber-300/40"
          >
            <p className="eyebrow">Fonte</p>
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

  // --------------------------------------------------------------- summary

  if (phase === "summary") {
    return (
      <section className="space-y-6">
        <div className="surface relative overflow-hidden rounded-[2rem] p-8 text-center">
          <div className="glass-gradient absolute inset-0 -z-10" />
          <p className="eyebrow">Fim de partida · {SOURCES.find((option) => option.id === source)?.label}</p>
          <p className="display-title mt-3 text-6xl text-amber-200">{results.reduce((sum, result) => sum + result.score, 0)}</p>
          <p className="mt-2 text-sm font-bold text-slate-400">
            {improved ? "🎉 Novo recorde!" : `Recorde: ${best[source] ?? "—"}`}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => startRun(source)} className="accent-button px-5 py-2.5 text-sm">Jogar de novo</button>
            <button type="button" onClick={() => setPhase("menu")} className="quiet-button px-5 py-2.5 text-sm">Trocar fonte</button>
          </div>
        </div>

        <ol className="grid gap-3 sm:grid-cols-2">
          {results.map((result, index) => (
            <li key={result.answer.tmdbId} className="surface-subtle flex items-center gap-4 rounded-2xl p-4">
              <div className="artwork-frame aspect-[2/3] w-14 shrink-0 rounded-lg">
                <ArtworkImage src={posterUrl(result.answer.posterPath)} alt={result.answer.title} title={result.answer.title} className="h-full w-full" sizes="56px" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-white">
                  {index + 1}. {result.answer.title} {result.answer.year ? <span className="text-slate-500">({result.answer.year})</span> : null}
                </p>
                <p className="mt-1 text-xs text-slate-500">{result.solved ? `${result.reveals} nome(s) revelado(s)` : "Não acertou"}</p>
              </div>
              <p className={`text-lg font-black tabular-nums ${result.solved ? "text-amber-200" : "text-slate-600"}`}>{result.score}</p>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  // --------------------------------------------------------------- playing

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-black text-white">
          Rodada <span className="text-amber-200">{roundNumber}</span> / {ROUNDS_PER_RUN}
          <span className="ml-3 text-xs font-bold text-slate-500">{SOURCES.find((option) => option.id === source)?.label}</span>
        </p>
        <p className="text-sm font-black tabular-nums text-white">
          Pontos: <span className="text-amber-200">{totalScore}</span>
        </p>
      </div>

      {/* Timer bar */}
      {!roundOver && !loadingRound && (
        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className={`h-full rounded-full transition-[width] duration-300 ${remaining < 10_000 ? "bg-red-400" : "bg-amber-300"}`}
            style={{ width: `${(remaining / ROUND_MS) * 100}%` }}
          />
        </div>
      )}

      {loadingRound ? (
        <div className="surface skeleton-bg h-72 rounded-[2rem]" />
      ) : roundOver ? (
        <motion.div
          key={`over-${roundOver.answer.tmdbId}`}
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 22 }}
          className={`surface relative overflow-hidden rounded-[2rem] border p-6 sm:p-8 ${roundOver.solved ? "border-amber-300/50" : "border-white/[0.08]"}`}
        >
          {roundOver.solved && (
            <div className="pointer-events-none absolute left-1/2 top-16 h-0 w-0">
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
              <ArtworkImage src={posterUrl(roundOver.answer.posterPath)} alt={roundOver.answer.title} title={roundOver.answer.title} className="h-full w-full" sizes="144px" />
            </motion.div>
            <div>
              <p className={`eyebrow ${roundOver.solved ? "!text-amber-300" : "!text-slate-500"}`}>
                {roundOver.solved ? "🎉 Acertou!" : "A resposta era"}
              </p>
              <h2 className="display-title mt-1 text-3xl sm:text-4xl">
                {roundOver.answer.title} {roundOver.answer.year ? <span className="text-slate-500">({roundOver.answer.year})</span> : null}
              </h2>
              <p className="mt-3 text-sm text-slate-400">Elenco: {roundOver.answer.cast.join(", ")}</p>
              <p className="mt-4 text-2xl font-black tabular-nums text-amber-200">+{roundOver.score} pontos</p>
              <button type="button" onClick={nextRound} className="accent-button mt-5 px-6 py-3 text-sm font-black">
                {roundNumber >= ROUNDS_PER_RUN ? "Ver resumo →" : "Próxima rodada →"}
              </button>
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="surface rounded-[2rem] p-6 sm:p-8">
          <p className="text-xs font-black uppercase tracking-wider text-slate-500">
            Elenco revelado <span className="text-amber-300">{cast.length}</span> / {totalCast}
            <span className="ml-2 normal-case text-slate-600">— menos nomes, mais pontos</span>
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <AnimatePresence initial={false}>
              {cast.map((name, index) => (
                <motion.span
                  key={name}
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  className={`rounded-full border px-4 py-2 text-sm font-black ${index === cast.length - 1 ? "border-amber-300/50 bg-amber-300/10 text-amber-100" : "border-white/[0.09] bg-white/[0.04] text-slate-200"}`}
                >
                  {name}
                </motion.span>
              ))}
            </AnimatePresence>
          </div>

          <motion.div
            key={shake}
            animate={shake ? { x: [0, -10, 10, -6, 6, 0] } : undefined}
            transition={{ duration: 0.4 }}
            className="relative mt-6"
          >
            <form
              onSubmit={(event) => { event.preventDefault(); void submitGuess(); }}
              className="flex gap-2"
            >
              <input
                value={guess}
                onChange={(event) => setGuess(event.target.value)}
                placeholder="Que filme é esse?"
                className="field flex-1"
                autoComplete="off"
                autoFocus
              />
              <button type="submit" disabled={busy || !guess.trim()} className="accent-button px-5 text-sm font-black disabled:opacity-50">
                Chutar
              </button>
            </form>
            {suggestions.length > 0 && (
              <ul className="surface-raised absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-white/10 p-1">
                {suggestions.map((suggestion) => (
                  <li key={`${suggestion.title}-${suggestion.year}`}>
                    <button
                      type="button"
                      onClick={() => { setGuess(suggestion.title); void submitGuess(suggestion.title); }}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm font-bold text-white hover:bg-white/[0.06]"
                    >
                      {suggestion.title} <span className="text-xs text-slate-500">{suggestion.year ?? ""}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={askHint} disabled={busy || cast.length >= totalCast} className="quiet-button px-4 py-2 text-xs disabled:opacity-40">
              + Revelar mais um nome ({cast.length}/{totalCast})
            </button>
            <button type="button" onClick={() => void giveUp(token, cast.length)} disabled={busy} className="quiet-button px-4 py-2 text-xs text-slate-500 disabled:opacity-40">
              Desistir
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
