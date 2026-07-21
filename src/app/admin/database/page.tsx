import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDatabaseReview, type ReadinessStatus } from "@/lib/db-review";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Revisão do Banco de Dados — FilmJournal",
};

const STATUS_ICON: Record<ReadinessStatus, string> = { ok: "✅", warn: "⚠️", fail: "❌" };
const SEVERITY_TONE: Record<ReadinessStatus, string> = {
  ok: "text-amber-200",
  warn: "text-yellow-300",
  fail: "text-red-400",
};

export default async function DatabaseReviewPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") {
    redirect("/login");
  }

  const review = await getDatabaseReview();

  const summaryCards = [
    { label: "Filmes no catálogo", value: review.summary.totalMovies },
    { label: "Entradas no diário", value: review.summary.totalLogs },
    { label: "Filmes com nota", value: review.summary.ratedLogs },
    { label: "Filmes sem TMDB ID", value: review.summary.moviesWithoutTmdb },
    { label: "Filmes para assistir", value: review.summary.watchlistMovies },
    { label: "Filmes favoritos", value: review.summary.favoriteMovies },
    { label: "Usuários cadastrados", value: review.summary.users },
    { label: "Diário vinculado a usuário", value: review.summary.logsWithUser },
  ];

  return (
    <main className="page-shell space-y-10">
      <section className="surface relative overflow-hidden rounded-[2rem] p-8 sm:p-10">
        <div className="glass-gradient absolute inset-0 -z-10" />
        <p className="eyebrow">Console do proprietário</p>
        <h1 className="display-title mt-4 text-4xl sm:text-6xl">Revisão do Banco de Dados</h1>
        <p className="mt-4 text-sm text-slate-400">
          Estado técnico atual do banco — todas as métricas são calculadas em tempo real.
        </p>
        <Link href="/admin" className="mt-4 inline-flex text-xs font-bold text-amber-300">← Voltar ao Admin</Link>
      </section>

      {/* Seção 1 — Resumo Geral */}
      <section>
        <h2 className="section-heading mb-4">Seção 1 — Resumo Geral</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {summaryCards.map((card) => (
            <div key={card.label} className="surface-subtle rounded-2xl p-5">
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-600">{card.label}</p>
              <p className="mt-1 text-3xl font-black tabular-nums text-white">{card.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Seção 2 — Integridade dos Dados */}
      <section>
        <h2 className="section-heading mb-4">Seção 2 — Integridade dos Dados</h2>
        <div className="surface overflow-hidden rounded-2xl">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.08] text-[10px] font-black uppercase tracking-wider text-slate-500">
                <th className="p-4">Verificação</th>
                <th className="p-4 text-right">Ocorrências</th>
                <th className="p-4">Exemplos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {review.integrity.map((issue) => (
                <tr key={issue.key}>
                  <td className="p-4 font-bold text-white">
                    <span className="mr-2">{STATUS_ICON[issue.severity]}</span>
                    {issue.label}
                  </td>
                  <td className={`p-4 text-right font-black tabular-nums ${issue.count > 0 ? SEVERITY_TONE[issue.severity] : "text-slate-500"}`}>
                    {issue.count}
                  </td>
                  <td className="p-4 text-xs text-slate-400">
                    {issue.samples.length > 0 ? issue.samples.map((s) => s.label).join(", ") : issue.count > 0 ? "—" : "Nenhum problema"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Seção 3 — Estrutura do Banco */}
      <section>
        <h2 className="section-heading mb-4">Seção 3 — Estrutura do Banco</h2>
        <div className="space-y-5">
          {review.schema.map((model) => (
            <div key={model.model} className="surface overflow-hidden rounded-2xl">
              <div className="border-b border-white/[0.08] p-4">
                <h3 className="font-black text-amber-200">{model.model}</h3>
              </div>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <th className="p-3 pl-4">Campo</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Obrigatório</th>
                    <th className="p-3">Descrição</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {model.fields.map((field) => (
                    <tr key={field.field}>
                      <td className="p-3 pl-4 font-mono text-xs font-bold text-white">{field.field}</td>
                      <td className="p-3 font-mono text-xs text-amber-200/80">{field.type}</td>
                      <td className="p-3 text-xs">{field.required ? <span className="text-amber-300">Sim</span> : <span className="text-slate-500">Não</span>}</td>
                      <td className="p-3 text-xs text-slate-400">{field.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </section>

      {/* Seção 4 — Prontidão para Múltiplos Usuários */}
      <section>
        <h2 className="section-heading mb-4">Seção 4 — Prontidão para Múltiplos Usuários</h2>
        <div className="surface rounded-2xl divide-y divide-white/[0.05]">
          {review.readiness.map((item) => (
            <div key={item.label} className="flex items-start gap-3 p-4">
              <span className="text-lg leading-none">{STATUS_ICON[item.status]}</span>
              <div>
                <p className="text-sm font-bold text-white">{item.label}</p>
                <p className={`mt-1 text-xs ${SEVERITY_TONE[item.status]}`}>{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
