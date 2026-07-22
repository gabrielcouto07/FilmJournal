"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ArtworkImage from "@/components/ArtworkImage";
import StarRating from "@/components/StarRating";
import { useToast } from "@/components/ToastProvider";
import { getPosterUrl } from "@/lib/tmdb";

type SearchResult = { id: number; title: string; release_date?: string; poster_path?: string | null };
type SeedPick = { tmdbId: number; title: string; year: number | null; posterPath: string | null; rating: number };

const MAX_SEEDS = 5;
const DEFAULT_RATING = 4;

const PILLARS = [
  {
    icon: "👅",
    eyebrow: "Paladar",
    title: "Seu gosto, mapeado.",
    text: "Cada filme avaliado vira um ponto no seu mapa: décadas, países, gêneros e diretores — e a distância entre as suas notas e o consenso do público.",
  },
  {
    icon: "🧭",
    eyebrow: "Descobrir + Roleta",
    title: "O que você ainda não viu.",
    text: "O Descobrir revela seus pontos cegos — épocas, países e gêneros que faltam no seu repertório. E quando bater a indecisão, a Roleta sorteia o próximo filme por você.",
  },
  {
    icon: "🎮",
    eyebrow: "Jogar",
    title: "Adivinhe o filme pelo elenco.",
    text: "Um jogo rápido com o seu acervo ou com filmes populares: o elenco aparece aos poucos e você tenta acertar o título com o mínimo de dicas.",
  },
];

// Steps: 0 = entry choice · 1..PILLARS.length = pillar explainers · last = seed favorites.
const SEED_STEP = PILLARS.length + 1;

export default function WelcomeFlow({ displayName }: { displayName: string }) {
  const [step, setStep] = useState(0);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [picks, setPicks] = useState<SeedPick[]>([]);
  const [busy, setBusy] = useState(false);
  const { notify } = useToast();
  const router = useRouter();

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/tmdb?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        if (!response.ok) throw new Error();
        const data = await response.json();
        setResults((data.results ?? []).slice(0, 8));
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  const addPick = (result: SearchResult) => {
    if (picks.length >= MAX_SEEDS || picks.some((pick) => pick.tmdbId === result.id)) return;
    setPicks([...picks, {
      tmdbId: result.id,
      title: result.title,
      year: result.release_date ? Number(result.release_date.slice(0, 4)) || null : null,
      posterPath: result.poster_path ?? null,
      rating: DEFAULT_RATING,
    }]);
  };

  const finish = async (seeds: SeedPick[]) => {
    setBusy(true);
    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seeds: seeds.map((pick) => ({ tmdbId: pick.tmdbId, rating: pick.rating })) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Não foi possível concluir agora.");
      notify(seeds.length ? "Tudo pronto! Suas análises já têm por onde começar. 🎬" : "Tudo pronto! Bom cinema. 🎬", "success");
      router.push("/");
      router.refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível concluir agora.", "error");
      setBusy(false);
    }
  };

  return (
    <main className="page-shell flex min-h-[70vh] flex-col justify-center">
      <section className="surface fade-up relative mx-auto w-full max-w-3xl overflow-hidden rounded-[2rem] p-7 sm:p-10">
        <div className="glass-gradient absolute inset-0 -z-10" />

        {step === 0 && (
          <div>
            <p className="eyebrow">Bem-vindo ao FilmJournal</p>
            <h1 className="display-title balance mt-4 text-4xl sm:text-5xl">Olá, {displayName}.</h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
              Este app transforma os filmes que você assiste num retrato do seu gosto. Como você quer começar?
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <button type="button" onClick={() => setStep(1)} className="surface-subtle rounded-2xl p-6 text-left transition hover:border-amber-300/25">
                <span className="grid h-11 w-11 place-items-center rounded-full border border-amber-300/25 bg-amber-300/10 text-lg" aria-hidden="true">✨</span>
                <span className="mt-4 block text-lg font-black text-white">Começar do zero</span>
                <span className="mt-2 block text-sm leading-6 text-slate-400">Um tour rápido pelo app e a escolha dos seus 5 filmes favoritos para acender as primeiras análises.</span>
                <span className="mt-4 inline-flex text-xs font-bold text-amber-300">Fazer o tour →</span>
              </button>
              <Link href="/profile#importar" className="surface-subtle rounded-2xl p-6 transition hover:border-amber-300/25">
                <span className="grid h-11 w-11 place-items-center rounded-full border border-amber-300/25 bg-amber-300/10 text-lg" aria-hidden="true">🎬</span>
                <span className="mt-4 block text-lg font-black text-white">Já uso o Letterboxd</span>
                <span className="mt-2 block text-sm leading-6 text-slate-400">Importe o seu histórico completo — diário, notas, resenhas e favoritos — de uma só vez.</span>
                <span className="mt-4 inline-flex text-xs font-bold text-amber-300">Importar meus filmes →</span>
              </Link>
            </div>
          </div>
        )}

        {step >= 1 && step <= PILLARS.length && (
          <div>
            <span className="grid h-12 w-12 place-items-center rounded-full border border-amber-300/25 bg-amber-300/10 text-xl" aria-hidden="true">{PILLARS[step - 1].icon}</span>
            <p className="eyebrow mt-5">{PILLARS[step - 1].eyebrow}</p>
            <h1 className="display-title balance mt-3 text-4xl sm:text-5xl">{PILLARS[step - 1].title}</h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">{PILLARS[step - 1].text}</p>
          </div>
        )}

        {step === SEED_STEP && (
          <div>
            <p className="eyebrow">Último passo</p>
            <h1 className="display-title balance mt-3 text-4xl sm:text-5xl">Escolha 5 filmes favoritos.</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-400">
              Eles semeiam o seu paladar — nota, gênero, época, país. Dá para mudar tudo depois.
            </p>

            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Busque um filme…"
              className="mt-6 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3.5 text-sm font-semibold text-white placeholder-slate-600 transition focus:border-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-300"
              aria-label="Buscar filme para adicionar aos favoritos"
            />

            {searching && <p className="mt-3 text-xs font-bold text-slate-500">Buscando…</p>}
            {!searching && results.length > 0 && picks.length < MAX_SEEDS && (
              <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-8">
                {results.map((result) => {
                  const picked = picks.some((pick) => pick.tmdbId === result.id);
                  return (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => addPick(result)}
                      disabled={picked}
                      className={`group text-left ${picked ? "opacity-40" : ""}`}
                      title={result.title}
                    >
                      <span className="block aspect-[2/3] overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.04] transition group-hover:border-amber-300/40">
                        <ArtworkImage src={getPosterUrl(result.poster_path)} alt={`Pôster de ${result.title}`} title={result.title} className="h-full w-full" sizes="90px" />
                      </span>
                      <span className="mt-1.5 block truncate text-[10px] font-bold text-slate-400 group-hover:text-white">{result.title}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-6 space-y-2">
              {picks.map((pick, index) => (
                <div key={pick.tmdbId} className="surface-subtle flex items-center gap-3 rounded-xl p-2.5 pr-4">
                  <span className="w-5 text-center text-xs font-black text-amber-300/60">{index + 1}</span>
                  <span className="block h-14 w-10 shrink-0 overflow-hidden rounded-md border border-white/[0.08]">
                    <ArtworkImage src={getPosterUrl(pick.posterPath)} alt={`Pôster de ${pick.title}`} title={pick.title} className="h-full w-full" sizes="40px" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-white">{pick.title}</span>
                    <span className="block text-xs text-slate-600">{pick.year ?? "—"}</span>
                  </span>
                  <StarRating
                    value={pick.rating}
                    size="sm"
                    onChange={(value) => setPicks(picks.map((item) => (item.tmdbId === pick.tmdbId ? { ...item, rating: value } : item)))}
                  />
                  <button
                    type="button"
                    onClick={() => setPicks(picks.filter((item) => item.tmdbId !== pick.tmdbId))}
                    className="text-xs font-black text-slate-600 transition hover:text-red-300"
                    aria-label={`Remover ${pick.title}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
              {picks.length === 0 && (
                <p className="empty-state !py-6 text-xs text-slate-500">Seus escolhidos aparecem aqui — busque acima e toque num pôster.</p>
              )}
              {picks.length > 0 && picks.length < MAX_SEEDS && (
                <p className="text-xs font-bold text-slate-600">Adicione mais filmes para enriquecer suas análises.</p>
              )}
            </div>
          </div>
        )}

        {step > 0 && (
          <div className="mt-10 flex items-center justify-between gap-4">
            <button type="button" onClick={() => setStep(step - 1)} className="quiet-button" disabled={busy}>
              ← Voltar
            </button>
            <div className="flex items-center gap-1.5" aria-hidden="true">
              {Array.from({ length: SEED_STEP }, (_, index) => (
                <span key={index} className={`h-1.5 w-1.5 rounded-full transition ${index + 1 === step ? "bg-amber-300" : "bg-white/15"}`} />
              ))}
            </div>
            {step < SEED_STEP ? (
              <button type="button" onClick={() => setStep(step + 1)} className="accent-button">
                Continuar →
              </button>
            ) : (
              <button
                type="button"
                onClick={() => finish(picks)}
                disabled={busy || picks.length === 0}
                className="accent-button disabled:opacity-50"
              >
                {busy ? "Salvando…" : `Concluir (${picks.length}/${MAX_SEEDS})`}
              </button>
            )}
          </div>
        )}

        {step > 0 && (
          <div className="mt-6 text-center">
            <button type="button" onClick={() => finish([])} disabled={busy} className="text-xs font-bold text-slate-600 transition hover:text-amber-300">
              Pular por enquanto
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
