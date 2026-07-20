import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin — FilmJournal",
};

// `middleware.ts` already gates /admin/* via the NextAuth session. This
// server-side check is defense-in-depth so the page never renders for a
// non-owner even if the matcher config changes.
export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") {
    redirect("/login");
  }

  const [movieCount, logCount, watchlistCount, favoriteCount] = await Promise.all([
    prisma.movie.count(),
    prisma.logEntry.count({ where: { userId: user.id } }),
    prisma.userMovie.count({ where: { userId: user.id, watchlist: true } }),
    prisma.userMovie.count({ where: { userId: user.id, favorite: true } }),
  ]);

  const stats = [
    { label: "Filmes no catálogo", value: movieCount },
    { label: "Entradas no diário", value: logCount },
    { label: "Na Watchlist", value: watchlistCount },
    { label: "Favoritos", value: favoriteCount },
  ];

  const actions = [
    { href: "/admin/database", title: "Revisão do banco", desc: "Estado técnico completo do banco de dados." },
    { href: "/search", title: "Adicionar filmes", desc: "Busque no TMDB e traga novos títulos para o catálogo." },
    { href: "/diary", title: "Gerenciar diário", desc: "Registre, edite e revise seu histórico de sessões." },
    { href: "/favorites", title: "Curar Top 10", desc: "Reordene seus favoritos ranqueados." },
    { href: "/profile#importar", title: "Importar do Letterboxd", desc: "Abra as configurações do perfil para importar ou atualizar seu acervo." },
  ];

  return (
    <main className="page-shell space-y-10">
      <section className="surface relative overflow-hidden rounded-[2rem] p-8 sm:p-10">
        <div className="glass-gradient absolute inset-0 -z-10" />
        <p className="eyebrow">Console do proprietário</p>
        <h1 className="display-title mt-4 text-4xl sm:text-6xl">Admin</h1>
        <p className="mt-4 text-sm text-slate-400">
          Conectado como <span className="font-bold text-amber-200">{user.displayName || user.username}</span>.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="surface-subtle rounded-2xl p-5">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-600">{stat.label}</p>
            <p className="mt-1 text-3xl font-black tabular-nums text-white">{stat.value}</p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="section-heading mb-4">Gerenciar conteúdo</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {actions.map((action) => (
            <Link key={action.href} href={action.href} className="surface rounded-2xl p-5 transition hover:border-amber-300/25">
              <h3 className="text-sm font-black text-white">{action.title}</h3>
              <p className="mt-1.5 text-xs text-slate-400">{action.desc}</p>
              <span className="mt-3 inline-flex text-xs font-bold text-amber-300">Abrir →</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
