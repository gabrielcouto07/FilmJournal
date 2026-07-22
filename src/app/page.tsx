import Link from "next/link";
import { redirect } from "next/navigation";
import BackgroundEnrich from "@/components/BackgroundEnrich";
import PublicOverview from "@/components/PublicOverview";
import TasteDashboard from "@/components/dashboard/TasteDashboard";
import { auth } from "@/auth";
import { getCurrentUser } from "@/lib/auth";
import { needsOnboarding } from "@/lib/onboarding";
import { getMotifsData, getPalateData, getStatsData, getTimelineData } from "@/lib/data";
import { computeVerdict, MIN_RATED_FOR_VERDICT } from "@/lib/analytics/verdict";

export const metadata = { title: "Paladar cinematográfico · FilmJournal" };

/**
 * Taste-first home: the app opens on who the viewer IS (the hero verdict),
 * not on what they logged. The full Paladar dashboards render below the fold
 * — progressive disclosure: punchy identity first, depth on scroll. The diary
 * keeps its own route (/diary) and its place in the nav.
 */
export default async function HomePage() {
  const session = await auth();
  // Unauthenticated visitors get the public discovery experience, never the
  // owner's private journal. Authenticated users get their taste profile.
  if (!session?.user) return <PublicOverview />;
  // First-run accounts get the guided welcome instead of an empty verdict.
  if (session.user.id && (await needsOnboarding(session.user.id))) redirect("/welcome");
  return <TasteFirstHome />;
}

async function TasteFirstHome() {
  const viewer = await getCurrentUser();
  const userId = viewer?.id ?? "";
  const [palate, stats, timeline, motifs] = await Promise.all([
    getPalateData(userId),
    getStatsData(userId),
    getTimelineData(userId),
    getMotifsData(userId),
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

  const verdict = computeVerdict({
    totalFilms: palate.totalFilms,
    contrarian: palate.contrarian,
    decades: palate.decades,
    genres: palate.genres,
    directors: palate.directors,
  });

  return (
    <main className="page-shell space-y-12">
      <BackgroundEnrich />

      {/* Hero verdict — one bold identity claim; the charts wait below. */}
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

      {/* Depth on demand — the full Paladar dashboards, unchanged in content. */}
      <div id="analises" className="fade-up fade-up-2 scroll-mt-24">
        <TasteDashboard palate={palate} stats={stats} timeline={timeline} motifs={motifs} />
      </div>
    </main>
  );
}
