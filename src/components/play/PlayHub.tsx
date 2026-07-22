"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import HybridGame from "@/components/play/HybridGame";
import RouletteBoard from "@/components/roulette/RouletteBoard";

type PlayTab = "jogo" | "roleta";
type BestScores = Partial<Record<"mine" | "popular" | "daily", number>>;

const TABS: Array<{ id: PlayTab; label: string; hint: string }> = [
  { id: "jogo", label: "🕵️ Cine-Detetive", hint: "Adivinhe o filme secreto" },
  { id: "roleta", label: "🎲 Roleta", hint: "Deixe o acaso escolher" },
];

// One hub for the two "jogar" experiences: the Cine-Detetive guessing game and
// the Roleta. They used to be separate pages; keeping them behind tabs means a
// single primary-nav slot. /roulette deep-links here via ?tab=roleta.
export default function PlayHub({ initialBest, initialTab = "jogo" }: { initialBest: BestScores; initialTab?: PlayTab }) {
  const [tab, setTab] = useState<PlayTab>(initialTab);
  const router = useRouter();

  const select = (next: PlayTab) => {
    setTab(next);
    // Keep the URL shareable/back-friendly without a full navigation.
    router.replace(next === "jogo" ? "/play" : `/play?tab=${next}`, { scroll: false });
  };

  return (
    <main className="page-shell max-w-6xl space-y-8">
      <nav className="flex flex-wrap gap-1 rounded-full border border-white/[0.07] bg-white/[0.025] p-1" aria-label="Modos de jogo">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => select(item.id)}
            aria-current={tab === item.id}
            title={item.hint}
            className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-wider transition ${tab === item.id ? "bg-amber-300 text-[#1a1400]" : "text-slate-400 hover:text-white"}`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "jogo" ? (
        <div className="space-y-8">
          <header>
            <p className="eyebrow">Jogar · Cine-Detetive</p>
            <h2 className="display-title mt-2 text-4xl sm:text-5xl">Descubra o filme.</h2>
            <p className="mt-4 max-w-2xl leading-7 text-slate-400">
              Você tem dez palpites para descobrir o filme secreto. O elenco aparece nome a nome, o
              pôster vai ganhando nitidez — e cada palpite mostra, em cores, o que bateu, o que chegou
              perto e o que passou longe: ano, gêneros, direção, estúdio, nota e elenco. Quanto menos
              palpites, mais pontos.
            </p>
          </header>
          <HybridGame initialBest={initialBest} />
        </div>
      ) : (
        <RouletteBoard />
      )}
    </main>
  );
}
