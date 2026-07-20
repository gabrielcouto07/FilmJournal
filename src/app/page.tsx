import Link from "next/link";
import type { Movie } from "@prisma/client";
import MovieCard from "@/components/MovieCard";
import StarRating from "@/components/StarRating";
import { getBackdropUrl, movieBackdropPath } from "@/lib/tmdb";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

import { getCurrentUser } from "@/lib/auth";
import { auth } from "@/auth";
import PublicOverview from "@/components/PublicOverview";

async function getDashboardData() {
  // Scoped to the signed-in user so every account sees its own journal.
  const viewer = await getCurrentUser();
  const ownerId = viewer?.id || "";

  const since = new Date(); since.setUTCMonth(since.getUTCMonth() - 11, 1); since.setUTCHours(0,0,0,0);
  const yearStart = new Date(`${new Date().getUTCFullYear()}-01-01T00:00:00.000Z`);

  const [rawLogs, logCount, watchedCount, reviewCount, rewatchCount, rawFavorites, rawWatchlist, rawTopRated, patternLogs, yearWatches] = await Promise.all([
    prisma.logEntry.findMany({ where: { userId: ownerId }, include:{movie:true}, orderBy:[{watchedAt:"desc"},{loggedAt:"desc"}], take:10 }),
    prisma.logEntry.count({ where: { userId: ownerId } }),
    prisma.userMovie.count({ where: { userId: ownerId, watched: true } }),
    prisma.logEntry.count({ where: { userId: ownerId, review: { not: null } } }),
    prisma.logEntry.count({ where: { userId: ownerId, rewatch: true } }),
    prisma.userMovie.findMany({ where: { userId: ownerId, favorite: true }, include: { movie: true }, orderBy: [{ favoriteRank: "asc" }, { rating: "desc" }, { updatedAt: "desc" }], take: 7 }),
    prisma.userMovie.findMany({ where: { userId: ownerId, watchlist: true }, include: { movie: true }, orderBy: [{ watchlistAddedAt: "desc" }, { updatedAt: "desc" }], take: 7 }),
    prisma.userMovie.findMany({ where: { userId: ownerId, rating: { not: null } }, include: { movie: true }, orderBy: [{ rating: "desc" }, { updatedAt: "desc" }], take: 7 }),
    prisma.logEntry.findMany({ where: { userId: ownerId, watchedAt: { gte: since } }, select: { watchedAt: true, loggedAt: true } }),
    prisma.logEntry.count({ where: { userId: ownerId, watchedAt: { gte: yearStart } } }),
  ]);

  // Gather movie ids to fetch user state map
  const movieIds = [
    ...rawLogs.map(l => l.movieId),
    ...rawFavorites.map(f => f.movieId),
    ...rawWatchlist.map(w => w.movieId),
    ...rawTopRated.map(t => t.movieId)
  ];
  const userMovies = await prisma.userMovie.findMany({
    where: { userId: ownerId, movieId: { in: movieIds } }
  });
  const umMap = new Map(userMovies.map(um => [um.movieId, um]));

  const enrichMovie = (movie: Movie) => {
    const um = umMap.get(movie.id);
    return {
      ...movie,
      rating: um?.rating ?? null,
      watched: um?.watched ?? false,
      favorite: um?.favorite ?? false,
      watchlist: um?.watchlist ?? false,
      watchlistAddedAt: um?.watchlistAddedAt ?? null,
      favoriteRank: um?.favoriteRank ?? null
    };
  };

  const recentLogs = rawLogs.map(log => ({
    ...log,
    movie: enrichMovie(log.movie)
  }));

  const favorites = rawFavorites.map(um => enrichMovie(um.movie));
  const watchlist = rawWatchlist.map(um => enrichMovie(um.movie));
  const topRated = rawTopRated.map(um => enrichMovie(um.movie));

  return {recentLogs,logCount,watchedCount,reviewCount,rewatchCount,favorites,watchlist,topRated,patternLogs,yearWatches};
}

export default async function HomePage() {
  const session = await auth();
  // Unauthenticated visitors get the public discovery experience, never the
  // owner's private journal. Authenticated users get their personal dashboard.
  if (!session?.user) return <PublicOverview />;
  return <OwnerDashboard />;
}

async function OwnerDashboard() {
  const data = await getDashboardData();
  const isEmpty = data.logCount === 0 && data.watchedCount === 0
    && data.favorites.length === 0 && data.watchlist.length === 0 && data.topRated.length === 0;
  if (isEmpty) return <main className="page-shell space-y-14"><ActivationPanel /></main>;
  const featured = data.recentLogs[0];
  const backdrop = getBackdropUrl(featured ? movieBackdropPath(featured.movie) : null);
  const monthCounts = new Map<string,number>();
  data.patternLogs.forEach((log)=>{const date=log.watchedAt??log.loggedAt;if(date){const key=`${date.getUTCFullYear()}-${date.getUTCMonth()}`;monthCounts.set(key,(monthCounts.get(key)??0)+1);}});
  const months = Array.from({length:12},(_,offset)=>{const date=new Date();date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()-(11-offset));const key=`${date.getUTCFullYear()}-${date.getUTCMonth()}`;return {label:new Intl.DateTimeFormat("pt-BR",{month:"short"}).format(date),value:monthCounts.get(key)??0};});
  const maxMonth=Math.max(1,...months.map((month)=>month.value));
  const currentYear=new Date().getUTCFullYear();
  const latestRating=featured?.rating ?? featured?.movie.rating;

  return <main className="page-shell space-y-14">
    <section className="fade-up grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(19rem,.45fr)]">
      <div className="surface relative isolate min-h-[31rem] overflow-hidden rounded-[2rem] p-6 sm:p-10 lg:p-12">
        {backdrop && <div className="absolute inset-0 -z-20 bg-cover bg-center opacity-55" style={{backgroundImage:`url(${backdrop})`}} />}
        <div className="glass-gradient absolute inset-0 -z-10" />
        <div className="flex h-full max-w-3xl flex-col justify-between"><div><p className="eyebrow">Agora no seu acervo</p><h1 className="display-title balance mt-5 text-5xl leading-[.92] sm:text-7xl lg:text-8xl">{featured ? featured.movie.title : "Seu cinema, eternizado."}</h1>{featured ? <><p className="mt-4 text-sm font-bold text-amber-200">{[featured.movie.year,featured.movie.runtime?`${featured.movie.runtime} min`:null,featured.movie.genres].filter(Boolean).join(" · ")}</p><p className="mt-5 line-clamp-3 max-w-2xl text-base leading-7 text-slate-300">{featured.review || featured.movie.overview || "O filme mais recente do seu registro pessoal."}</p></> : <p className="mt-5 max-w-xl text-slate-300">Importe seu histórico ou explore um filme para começar.</p>}</div><div className="mt-10 flex flex-wrap items-center gap-3">{featured && <Link href={`/film/${featured.movie.id}`} className="accent-button">Ver detalhes <span className="ml-2">→</span></Link>}<Link href="/diary" className="quiet-button">Ver diário</Link>{latestRating != null && <div className="ml-1"><StarRating value={latestRating} readOnly showValue /></div>}</div></div>
      </div>
      <aside className="surface fade-up fade-up-1 flex flex-col rounded-[2rem] p-5 sm:p-7"><div><p className="eyebrow">Em Números · {currentYear}</p><p className="display-title mt-3 text-5xl">{data.yearWatches}</p><p className="mt-1 text-sm text-slate-500">sessões este ano</p></div><div className="my-6 h-px bg-white/[0.08]" /><div className="grid grid-cols-2 gap-2"><Metric label="Diário" value={data.logCount} accent /><Metric label="Filmes vistos" value={data.watchedCount} /><Metric label="Resenhas" value={data.reviewCount} /><Metric label="Reexibições" value={data.rewatchCount} /></div><div className="mt-auto pt-6"><div className="flex items-end justify-between"><div><p className="text-xs font-bold text-white">Ritmo de 12 meses</p><p className="mt-1 text-[10px] text-slate-600">Eventos reais do diário</p></div><Link href="/stats" className="text-xs font-bold text-amber-300">Ver estatísticas →</Link></div><div className="mt-4 flex h-20 items-end gap-1.5">{months.map((month)=><div key={`${month.label}-${month.value}`} className="group flex flex-1 flex-col items-center justify-end gap-1"><div title={`${month.label}: ${month.value}`} className="w-full will-change-transform rounded-t-sm bg-amber-300/40 transition-all duration-500 ease-out hover:bg-amber-300 group-hover:bg-amber-300" style={{height:`${Math.max(4,(month.value/maxMonth)*58)}px`}} /><span className="hidden text-[7px] text-slate-700 first:block last:block sm:block">{month.label[0]}</span></div>)}</div><Link href="/roulette" className="accent-button glow-pulse w-full mt-5 justify-center py-3 text-xs font-black">Sortear um Filme 🎲</Link></div></aside>
    </section>

    <section className="fade-up fade-up-2"><SectionHead eyebrow="Visto Recentemente" title="Vistos recentemente." href="/diary" link="Abrir diário" />{data.recentLogs.length?<div className="rail -mx-1 flex gap-3 overflow-x-auto px-1 pb-6">{data.recentLogs.map((log,index)=><div key={log.id} className="w-36 shrink-0 sm:w-44 lg:w-48"><MovieCard movie={log.movie} log={log} priority={index<3}/></div>)}</div>:<Empty text="Nenhum registro ainda." href="/search" />}</section>

    <div className="grid gap-10 lg:grid-cols-[1.35fr_.65fr]">
      <section className="fade-up fade-up-3"><SectionHead eyebrow="Seus Favoritos" title="Seus favoritos." href="/favorites" link="Ver favoritos" />{data.favorites.length?<div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-7">{data.favorites.map((movie,index)=><div key={movie.id} className={index===0?"col-span-2 row-span-2 sm:col-span-2":""}><MovieCard movie={movie} rank={movie.favoriteRank??undefined} /></div>)}</div>:<Empty text="Adicione favoritos para ver aqui." href="/diary" />}</section>
      <section className="fade-up fade-up-4"><SectionHead eyebrow="Watchlist" title="Watchlist." href="/watchlist" link="Ver Watchlist" /><div className="space-y-2">{data.watchlist.length?data.watchlist.map((movie,index)=><Link key={movie.id} href={`/film/${movie.id}`} className="surface-subtle flex items-center gap-3 rounded-xl p-3 transition hover:border-amber-300/25"><span className="w-5 text-xs font-black text-amber-300/60">{String(index+1).padStart(2,"0")}</span><span className="min-w-0 flex-1 truncate text-sm font-bold text-white">{movie.title}</span><span className="text-xs text-slate-600">{movie.year??"—"}</span></Link>):<Empty text="Sua Watchlist está vazia." href="/search" />}</div></section>
    </div>

    <section className="fade-up fade-up-5"><SectionHead eyebrow="Melhores Avaliados" title="Os mais bem avaliados." href="/stats" link="Ver estatísticas" />{data.topRated.length?<div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">{data.topRated.map((movie)=><MovieCard key={movie.id} movie={movie}/>)}</div>:<Empty text="Avalie filmes para ver aqui." href="/diary" />}</section>
  </main>;
}

function Metric({label,value,accent=false}:{label:string;value:number;accent?:boolean}) { return <div className="surface-subtle rounded-2xl p-4"><p className="text-[9px] font-black uppercase tracking-wider text-slate-600">{label}</p><p className={`mt-1 text-3xl font-black tabular-nums ${accent?"text-amber-200":"text-white"}`}>{value}</p></div>; }
function SectionHead({eyebrow,title,href,link}:{eyebrow:string;title:string;href:string;link:string}) { return <div className="mb-5 flex items-end justify-between gap-4"><div><p className="eyebrow">{eyebrow}</p><h2 className="section-heading mt-2">{title}</h2></div><Link href={href} className="text-xs font-bold text-amber-300 hover:text-amber-200 sm:text-sm">{link} →</Link></div>; }
function Empty({text,href}:{text:string;href:string}) { return <div className="empty-state !py-8"><p className="font-bold text-white">{text}</p><Link href={href} className="mt-3 inline-flex text-xs font-bold text-amber-300">Explorar →</Link></div>; }

function ActivationPanel() {
  return <section className="fade-up surface relative overflow-hidden rounded-[2rem] p-7 sm:p-10">
    <div className="glass-gradient absolute inset-0 -z-10" />
    <p className="eyebrow">Bem-vindo ao FilmJournal</p>
    <h1 className="display-title balance mt-4 text-4xl sm:text-5xl">Vamos preencher seu diário.</h1>
    <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">Sua conta ainda não tem filmes. Importe seu histórico do Letterboxd ou explore filmes para começar a registrar.</p>
    <div className="mt-8 grid gap-4 lg:grid-cols-2">
      <div className="surface-subtle rounded-2xl p-6">
        <span className="grid h-11 w-11 place-items-center rounded-full border border-amber-300/25 bg-amber-300/10 text-lg" aria-hidden="true">🎬</span>
        <h2 className="mt-4 text-lg font-black text-white">Importar do Letterboxd</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">Traga todo o seu histórico — diário, notas, resenhas, watchlist e favoritos — enviando o arquivo .zip do Letterboxd. Preenche seu perfil de uma só vez.</p>
        <div className="mt-5">
          <Link href="/import" className="accent-button">Importar meus filmes →</Link>
        </div>
      </div>
      <div className="surface-subtle rounded-2xl p-6">
        <span className="grid h-11 w-11 place-items-center rounded-full border border-amber-300/25 bg-amber-300/10 text-lg" aria-hidden="true">🍿</span>
        <h2 className="mt-4 text-lg font-black text-white">Explorar filmes</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">Busque títulos, adicione ao diário ou à watchlist, ou deixe a roleta escolher por você.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/search" className="accent-button">Descobrir filmes →</Link>
          <Link href="/roulette" className="quiet-button">Sortear um filme 🎲</Link>
        </div>
      </div>
    </div>
  </section>;
}
