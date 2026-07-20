/* eslint-disable @next/next/no-img-element -- avatars are user-provided data URLs or arbitrary external URLs, which next/image cannot optimize/whitelist. */
import { notFound } from "next/navigation";
import Link from "next/link";
import MovieCard from "@/components/MovieCard";
import ShareProfileButton from "@/components/ShareProfileButton";
import StarRating from "@/components/StarRating";
import { prisma } from "@/lib/prisma";
import { getUserSettings } from "@/lib/settings";
import type { EnrichedMovie } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) notFound();

  const settings = await getUserSettings(user.id);
  const displayName = user.displayName || user.username;
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "FJ";

  if (settings.profileVisibility !== "public") {
    return (
      <main className="page-shell">
        <div className="empty-state mt-10">
          <p className="text-lg font-bold text-white">Perfil privado</p>
          <p className="mt-2 text-sm text-slate-400">@{username} mantém o diário privado.</p>
          <Link href="/" className="accent-button mt-5">Ir para a Visão Geral</Link>
        </div>
      </main>
    );
  }

  const [logCount, watchedCount, ratedCount, favorites, recentLogs, recentReviews] = await Promise.all([
    prisma.logEntry.count({ where: { userId: user.id } }),
    prisma.userMovie.count({ where: { userId: user.id, watched: true } }),
    prisma.userMovie.count({ where: { userId: user.id, rating: { not: null } } }),
    prisma.userMovie.findMany({
      where: { userId: user.id, OR: [{ favorite: true }, { favoriteRank: { not: null } }] },
      include: { movie: true }, orderBy: [{ favoriteRank: "asc" }, { updatedAt: "desc" }], take: 7,
    }),
    prisma.logEntry.findMany({
      where: { userId: user.id }, include: { movie: true },
      orderBy: [{ watchedAt: "desc" }, { loggedAt: "desc" }], take: 8,
    }),
    prisma.logEntry.findMany({
      where: { userId: user.id, review: { not: null } },
      include: { movie: { select: { id: true, title: true, year: true } } },
      orderBy: [{ watchedAt: "desc" }, { loggedAt: "desc" }], take: 4,
    }),
  ]);

  const favoriteMovies: EnrichedMovie[] = favorites.map((um) => ({ ...um.movie, favorite: um.favorite, favoriteRank: um.favoriteRank, rating: um.rating }));

  return (
    <main className="page-shell space-y-12">
      <section className="surface relative overflow-hidden rounded-[2rem] p-7 sm:p-10">
        <div className="glass-gradient absolute inset-0 -z-10" />
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          {user.avatarUrl
            ? <img src={user.avatarUrl} alt={`Avatar de ${displayName}`} className="h-24 w-24 rounded-full border border-white/10 object-cover" />
            : <span className="grid h-24 w-24 place-items-center rounded-full border border-amber-300/25 bg-amber-300/10 text-3xl font-black" style={{ color: "var(--accent)" }}>{initials}</span>}
          <div className="min-w-0">
            <p className="eyebrow">Perfil público</p>
            <h1 className="display-title mt-2 text-4xl sm:text-6xl">{displayName}</h1>
            <p className="mt-2 text-sm text-slate-400">@{user.username}</p>
            {user.bio && <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">{user.bio}</p>}
            <div className="mt-5"><ShareProfileButton username={user.username} /></div>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-3 gap-3 sm:max-w-md">
          <Stat label="No diário" value={logCount} />
          <Stat label="Assistidos" value={watchedCount} />
          <Stat label="Avaliados" value={ratedCount} />
        </div>
      </section>

      {favoriteMovies.length > 0 && (
        <section>
          <p className="eyebrow">Cânone pessoal</p>
          <h2 className="section-heading mt-2">Favoritos.</h2>
          <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-7">
            {favoriteMovies.map((movie) => <MovieCard key={movie.id} movie={movie} rank={movie.favoriteRank ?? undefined} />)}
          </div>
        </section>
      )}

      {recentLogs.length > 0 && (
        <section>
          <p className="eyebrow">Atividade recente</p>
          <h2 className="section-heading mt-2">Visto recentemente.</h2>
          <div className="rail mt-5 -mx-1 flex gap-3 overflow-x-auto px-1 pb-6">
            {recentLogs.map((log) => (
              <div key={log.id} className="w-36 shrink-0 sm:w-44">
                <MovieCard movie={log.movie} log={log} />
              </div>
            ))}
          </div>
        </section>
      )}

      {recentReviews.length > 0 && (
        <section>
          <p className="eyebrow">Do diário</p>
          <h2 className="section-heading mt-2">Resenhas recentes.</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {recentReviews.map((log) => {
              const date = log.watchedAt ?? log.loggedAt;
              return (
                <article key={log.id} className="surface-subtle rounded-2xl p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Link href={`/film/${log.movie.id}`} className="min-w-0 truncate text-sm font-black text-white hover:underline">
                      {log.movie.title} <span className="font-bold text-slate-500">({log.movie.year ?? "—"})</span>
                    </Link>
                    {log.rating != null && <StarRating value={log.rating} readOnly size="sm" />}
                  </div>
                  <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-slate-300">{log.review}</p>
                  <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-slate-600">
                    {date ? new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date) : "Sem data"}
                    {log.rewatch ? " · Reexibição" : ""}
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {logCount === 0 && favoriteMovies.length === 0 && (
        <div className="empty-state"><p className="font-bold text-white">@{username} ainda não registrou filmes.</p></div>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface-subtle rounded-2xl p-4 text-center">
      <p className="text-2xl font-black tabular-nums text-white">{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-slate-600">{label}</p>
    </div>
  );
}
