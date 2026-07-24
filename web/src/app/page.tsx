import Link from "next/link";
import { redirect } from "next/navigation";
import BackgroundEnrich from "@/components/BackgroundEnrich";
import PublicOverview from "@/components/PublicOverview";
import TasteDashboard from "@/components/dashboard/TasteDashboard";
import { apiGet, getSessionUser } from "@/lib/api-server";
import type { StatsData } from "@/lib/data";
import type { Palate } from "@/lib/analytics/palate";
import type { Timeline } from "@/lib/analytics/timeline";
import type { MotifSummary } from "@/lib/analytics/motifs";
import { MIN_RATED_FOR_VERDICT, type Verdict } from "@/lib/analytics/verdict";

export const metadata = { title: "Paladar cinematográfico · FilmJournal" };

/** A página começa pelo perfil de gosto e deixa os detalhes para a rolagem. */
export default async function HomePage() {
  const session = await getSessionUser();
  // Visitantes veem a página pública; o diário continua privado.
  if (!session) return <PublicOverview />;
  // Contas novas passam pela introdução antes de ver um perfil vazio.
  const { onboarded } = await apiGet<{ onboarded: boolean }>("/profile");
  if (!onboarded) redirect("/welcome");
  return <TasteFirstHome />;
}

async function TasteFirstHome() {
  const [palate, stats, timeline, motifs] = await Promise.all([
    apiGet<Palate & { verdict: Verdict }>("/palate"),
    apiGet<StatsData>("/stats"),
    apiGet<Timeline>("/timeline"),
    apiGet<MotifSummary>("/motifs"),
  ]);

  if (stats.sessions === 0 && palate.contrarian.sampleSize === 0) {
    return (
      <main className="page-shell">
        <header>
          <p className="eyebrow">Paladar cinematográfico</p>
          <h1 className="display-title mt-3 text-5xl sm:text-6xl">Seu mapa de gosto.</h1>
        </header>
        <div className="empty-state mt-10">
          <p className="text-sm text-slate-400">
            Ainda não há registros suficientes para montar seu mapa. Registre e avalie alguns
            filmes no diário e volte aqui.
          </p>
          <Link href="/diary" className="accent-button mt-6">Abrir diário</Link>
        </div>
      </main>
    );
  }

  const verdict = palate.verdict;

  return (
    <main className="page-shell space-y-12">
      <BackgroundEnrich />

      {/* Resumo principal do perfil */}
      <section className="fade-up surface relative overflow-hidden rounded-[2rem] p-7 sm:p-12 lg:p-16">
        <div className="glass-gradient absolute inset-0 -z-10" />
        <p className="eyebrow">Seu paladar · O veredito</p>
        {verdict.thin ? (
          <>
            <h1 className="display-title balance mt-5 text-5xl leading-[.95] sm:text-7xl">
              Seu paladar ainda está se revelando.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Avalie mais alguns filmes — a partir de {MIN_RATED_FOR_VERDICT} notas, seu retrato
              como espectador aparece aqui em uma frase.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/search" className="accent-button">Descobrir filmes →</Link>
              <Link href="/diary" className="quiet-button">Abrir diário</Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="display-title balance mt-5 text-5xl leading-[.95] sm:text-7xl lg:text-8xl">
              {verdict.headline}
            </h1>
            <p className="balance mt-7 max-w-4xl text-xl leading-relaxed text-slate-200 sm:text-2xl sm:leading-relaxed">
              {verdict.sentence}
            </p>
            <p className="mt-7 text-xs font-bold text-slate-600">
              {stats.sessions} sessões · {palate.totalFilms} filmes avaliados · {palate.contrarian.sampleSize} com dados do público
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#analises" className="accent-button">Explorar as análises ↓</a>
              <Link href="/diary" className="quiet-button">Abrir diário</Link>
            </div>
          </>
        )}
      </section>

      {/* Detalhes do Paladar */}
      <div id="analises" className="fade-up fade-up-2 scroll-mt-24">
        <TasteDashboard palate={palate} stats={stats} timeline={timeline} motifs={motifs} />
      </div>
    </main>
  );
}
