import Link from "next/link";
import { redirect } from "next/navigation";
import BackgroundEnrich from "@/components/BackgroundEnrich";
import { getCurrentUser } from "@/lib/auth";
import { needsOnboarding } from "@/lib/onboarding";
import { getPalateData, getStatsData } from "@/lib/data";
import type { ContrarianPoint, DirectorLoyalty } from "@/lib/analytics/palate";
import {
  ContrarianScatter,
  CountrySpread,
  DecadeHistogram,
  GenreRadar,
  RuntimeDistribution,
} from "@/components/palate/PalateCharts";

export const metadata = { title: "Paladar cinematográfico · FilmJournal" };

export default async function DashboardPage() {
  const viewer = await getCurrentUser();
  // First-run accounts get the guided welcome instead of an empty dashboard.
  if (viewer && (await needsOnboarding(viewer.id))) redirect("/welcome");
  const userId = viewer?.id ?? "";
  const [palate, stats] = await Promise.all([getPalateData(userId), getStatsData(userId)]);
  const { contrarian, decades, countries, genres, runtimes, directors, totalFilms } = palate;

  if (stats.sessions === 0 && contrarian.sampleSize === 0) {
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

  const lean = contrarian.tasteLean;
  const leanText =
    Math.abs(lean) < 0.1
      ? "Suas notas acompanham de perto o consenso — você é um termômetro do gosto médio."
      : lean > 0
        ? `Você avalia ${lean.toFixed(2)} estrela acima do público, em média — um paladar generoso.`
        : `Você avalia ${Math.abs(lean).toFixed(2)} estrela abaixo do público, em média — um paladar exigente.`;

  const monthLabel = (key: string) =>
    new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(`${key}-01T12:00:00Z`));

  return (
    <main className="page-shell space-y-10">
      <BackgroundEnrich />
      <header className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="eyebrow">Paladar cinematográfico</p>
          <h1 className="display-title mt-3 text-5xl sm:text-7xl">Seu mapa de gosto.</h1>
          <p className="mt-4 max-w-2xl leading-7 text-slate-400">
            O arquivo em números e onde seu gosto pousa por década, geografia e gênero — e a que
            distância você fica do consenso da crítica e do público.
          </p>
        </div>
        <p className="self-end text-xs font-bold text-slate-600">
          {stats.sessions} sessões · {totalFilms} filmes avaliados · {contrarian.sampleSize} com dados do público
        </p>
      </header>

      {/* Archive at a glance (merged from /stats) */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Stat label="Total de sessões" value={stats.sessions} />
        <Stat label="Filmes assistidos" value={stats.watchedCount} />
        <Stat label="Nota média" value={stats.average != null ? stats.average.toFixed(2) : "—"} accent />
        <Stat label="Resenhas" value={stats.reviews} />
        <Stat label="Reexibições" value={stats.rewatches} />
        <Stat label="Entradas avaliadas" value={stats.ratedCount} />
      </section>

      {/* Year in review (merged from /stats) */}
      {stats.retro.sessions > 0 && (
        <section className="surface relative overflow-hidden rounded-[1.75rem] p-6 sm:p-8">
          <div className="glass-gradient absolute inset-0 -z-10" />
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Retrospectiva · {stats.retro.year}</p>
              <h2 className="section-heading mt-2">Seu ano em cartaz.</h2>
            </div>
            <p className="text-xs font-bold text-slate-500">Atualizada em tempo real ao longo do ano</p>
          </div>
          <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Retro label="Sessões" value={stats.retro.sessions} accent />
            <Retro label="Nota média" value={stats.retro.average != null ? stats.retro.average.toFixed(2) : "—"} />
            <Retro label="Resenhas" value={stats.retro.reviews} />
            <Retro label="Gênero do ano" value={stats.retro.topGenre ?? "—"} />
            <Retro label="Diretor(a) do ano" value={stats.retro.topDirector ?? "—"} />
            <Retro label="Mês mais ativo" value={stats.retro.busiestMonth ?? "—"} />
          </div>
        </section>
      )}

      {/* Hero — contrarian analysis */}
      {contrarian.sampleSize > 0 ? (
        <section className="surface relative overflow-hidden rounded-[1.75rem] p-5 sm:p-7">
          <div className="glass-gradient absolute inset-0 -z-10" />
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Você contra a maré</p>
              <h2 className="section-heading mt-2">Você e o consenso.</h2>
            </div>
            <div className="flex gap-3">
              <Headline label="Distância do consenso" value={`${contrarian.contrarianScore.toFixed(2)}★`} />
              <Headline
                label={lean >= 0 ? "Tendência generosa" : "Tendência exigente"}
                value={`${lean > 0 ? "+" : ""}${lean.toFixed(2)}★`}
                accent
              />
            </div>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">{leanText}</p>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.45fr_1fr]">
            <div className="rounded-2xl bg-black/20 p-3 sm:p-4">
              <ContrarianScatter points={contrarian.points} />
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 px-1 text-[11px] font-bold text-slate-500">
                <Legend color="#f5c518" label="Você gosta mais que o público" />
                <Legend color="#74b9ff" label="Você gosta menos" />
                <Legend color="#6b655c" label="Vocês concordam" />
                <span className="text-slate-600">— linha tracejada = acordo perfeito</span>
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
              <ContrarianList title="Amores contrarian" subtitle="Você ama, o público nem tanto" points={contrarian.loves} tone="love" />
              <ContrarianList title="Rejeições contrarian" subtitle="O público ama, você nem tanto" points={contrarian.pans} tone="pan" />
            </div>
          </div>
        </section>
      ) : (
        <section className="empty-state">
          <p className="text-sm text-slate-400">
            Avalie filmes com dados do público (nota TMDb) para desbloquear a análise de consenso
            e os mapas de gosto abaixo.
          </p>
        </section>
      )}

      {/* Pace & rating scale (merged from /stats) */}
      <section className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <Card eyebrow="Ao longo do tempo" heading="Ritmo de visualização.">
          {stats.monthSeries.length ? (
            <div className="flex h-64 items-end gap-2 border-b border-white/[0.08] pb-1">
              {stats.monthSeries.map(({ key, count }) => (
                <div key={key} className="group flex h-full flex-1 flex-col items-center justify-end gap-2">
                  <span className="text-[9px] font-black text-slate-500 opacity-0 transition group-hover:opacity-100">{count}</span>
                  <div className="w-full rounded-t-md bg-gradient-to-t from-amber-400/35 to-amber-300 transition group-hover:brightness-125" style={{ height: `${Math.max(3, (count / stats.maxMonth) * 190)}px` }} />
                  <span className="-rotate-45 whitespace-nowrap text-[8px] font-bold text-slate-600 sm:rotate-0">{monthLabel(key)}</span>
                </div>
              ))}
            </div>
          ) : (
            <Insufficient />
          )}
        </Card>
        <Card eyebrow="Sua escala" heading="Distribuição de notas.">
          <div className="space-y-3">
            {stats.distribution.map((item) => (
              <div key={item.rating} className="grid grid-cols-[2.4rem_1fr_2rem] items-center gap-3">
                <span className="text-xs font-black text-amber-200">{item.rating.toFixed(1)}</span>
                <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.05]">
                  <div className="h-full rounded-full bg-amber-300/70" style={{ width: `${(item.count / stats.maxRating) * 100}%` }} />
                </div>
                <span className="text-right text-xs font-bold tabular-nums text-slate-600">{item.count}</span>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* Taste maps */}
      <section className="grid gap-5 lg:grid-cols-2">
        <Card eyebrow="Linha do tempo" heading="Décadas que você percorre.">
          <DecadeHistogram data={decades} />
        </Card>
        <Card eyebrow="Equilíbrio de gêneros" heading="Onde seu gosto se concentra.">
          {genres.length >= 3 ? <GenreRadar data={genres.slice(0, 8)} /> : <Insufficient />}
        </Card>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Card eyebrow="Geografia" heading="De onde vêm seus filmes.">
          {countries.length ? <CountrySpread data={countries.slice(0, 12)} /> : <Insufficient />}
        </Card>
        <Card eyebrow="Fôlego" heading="Sua duração ideal." note="A faixa em destaque é a que você mais assiste.">
          <RuntimeDistribution data={runtimes} />
        </Card>
      </section>

      <Card eyebrow="Atrás das câmeras" heading="Diretores a que você sempre volta." note="Cineastas com 3+ filmes avaliados.">
        {directors.length ? (
          <ol className="mt-4 grid gap-x-8 gap-y-1 sm:grid-cols-2">
            {directors.map((director, index) => (
              <DirectorRow key={`${director.directorId ?? director.name}`} rank={index + 1} director={director} />
            ))}
          </ol>
        ) : (
          <Insufficient message="Avalie 3+ filmes de um mesmo diretor para revelar sua fidelidade." />
        )}
      </Card>
    </main>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="surface-subtle rounded-2xl p-4 sm:p-5">
      <p className="text-[9px] font-black uppercase tracking-[.14em] text-slate-600">{label}</p>
      <p className={`mt-2 text-3xl font-black tabular-nums ${accent ? "text-amber-200" : "text-white"}`}>{value}</p>
    </div>
  );
}

function Retro({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="surface-subtle rounded-2xl p-4">
      <p className="text-[9px] font-black uppercase tracking-[.14em] text-slate-600">{label}</p>
      <p className={`mt-2 truncate text-lg font-black capitalize ${accent ? "text-amber-200" : "text-white"}`} title={String(value)}>{value}</p>
    </div>
  );
}

function Headline({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="surface-subtle rounded-2xl px-4 py-3 text-right">
      <p className="text-[9px] font-black uppercase tracking-[.14em] text-slate-600">{label}</p>
      <p className={`mt-1 text-2xl font-black tabular-nums ${accent ? "text-amber-200" : "text-white"}`}>{value}</p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function Card({ eyebrow, heading, note, children }: { eyebrow: string; heading: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="surface rounded-[1.75rem] p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="section-heading mt-2">{heading}</h2>
        </div>
        {note && <p className="max-w-[16rem] text-right text-[11px] font-bold text-slate-600">{note}</p>}
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function ContrarianList({ title, subtitle, points, tone }: { title: string; subtitle: string; points: ContrarianPoint[]; tone: "love" | "pan" }) {
  const accent = tone === "love" ? "text-amber-200" : "text-sky-300";
  return (
    <div className="surface-subtle rounded-2xl p-4">
      <p className={`text-xs font-black ${accent}`}>{title}</p>
      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">{subtitle}</p>
      {points.length ? (
        <ol className="mt-3 space-y-2">
          {points.map((point) => (
            <li key={point.id} className="flex items-center justify-between gap-3 text-xs">
              <span className="min-w-0 flex-1 truncate font-bold text-slate-200">
                {point.title}
                {point.year ? <span className="text-slate-600"> · {point.year}</span> : null}
              </span>
              <span className="shrink-0 tabular-nums text-slate-500">
                {point.userRating.toFixed(1)} vs {point.crowdRating.toFixed(1)}
              </span>
              <span className={`shrink-0 tabular-nums font-black ${accent}`}>
                {point.delta > 0 ? "+" : ""}{point.delta.toFixed(1)}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-xs text-slate-600">Nada marcante nesta ponta.</p>
      )}
    </div>
  );
}

function DirectorRow({ rank, director }: { rank: number; director: DirectorLoyalty }) {
  return (
    <li className="flex items-center gap-4 border-b border-white/[0.06] py-2.5">
      <span className="w-6 text-lg font-black text-violet-300/50">{String(rank).padStart(2, "0")}</span>
      <span className="flex-1 truncate text-sm font-bold text-white">{director.name}</span>
      <span className="text-xs text-slate-500">{director.count} filmes</span>
      <span className="w-14 text-right text-xs font-black tabular-nums text-amber-200">{director.averageRating.toFixed(2)}★</span>
    </li>
  );
}

function Insufficient({ message = "Dados insuficientes ainda." }: { message?: string }) {
  return <p className="py-10 text-center text-sm text-slate-600">{message}</p>;
}
