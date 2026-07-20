import Link from "next/link";
import MovieCard from "@/components/MovieCard";
import TasteExplorer from "@/components/TasteExplorer";
import { prisma } from "@/lib/prisma";
import { getTasteData } from "@/lib/recommendations";
import { enrichStatsMoviesForUser } from "@/lib/movie-metadata";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { getCurrentUser } from "@/lib/auth";

export default async function StatsPage() {
  const viewer = await getCurrentUser();
  const ownerId = viewer?.id || "";

  await enrichStatsMoviesForUser(ownerId);

  const [logs, userMoviesWatched, userMoviesHighest, tasteData] = await Promise.all([
    prisma.logEntry.findMany({ where: { userId: ownerId }, include:{movie:true}, orderBy:{watchedAt:"asc"} }),
    prisma.userMovie.findMany({ where: { userId: ownerId, watched: true }, include: { movie: { select: { genres: true, directors: true } } } }),
    prisma.userMovie.findMany({ where: { userId: ownerId, rating: { not: null } }, include: { movie: true }, orderBy: [{ rating: "desc" }, { updatedAt: "desc" }], take: 8 }),
    getTasteData({ userId: ownerId }),
  ]);

  const watchedMovies = userMoviesWatched.map((um) => um.movie);
  const highestRated = userMoviesHighest.map((um) => ({
    ...um.movie,
    rating: um.rating,
    watched: um.watched,
    favorite: um.favorite,
    watchlist: um.watchlist,
    watchlistAddedAt: um.watchlistAddedAt,
    favoriteRank: um.favoriteRank
  }));

  const rated=logs.filter((log)=>log.rating!=null);
  const average=rated.length?rated.reduce((sum,log)=>sum+(log.rating??0),0)/rated.length:0;
  const distribution=Array.from({length:10},(_,index)=>{const rating=(index+1)/2;return {rating,count:rated.filter((log)=>log.rating===rating).length};});
  const maxRating=Math.max(1,...distribution.map((item)=>item.count));
  const months=new Map<string,number>();
  logs.forEach((log)=>{const date=log.watchedAt??log.loggedAt;if(date){const key=date.toISOString().slice(0,7);months.set(key,(months.get(key)??0)+1);}});
  const monthSeries=[...months.entries()].sort(([a],[b])=>a.localeCompare(b)).slice(-18);
  const maxMonth=Math.max(1,...monthSeries.map(([,count])=>count));
  const countValues=(values:Array<string|null>)=>{const map=new Map<string,number>();values.flatMap((value)=>value?.split(",").map((item)=>item.trim()).filter(Boolean)??[]).forEach((value)=>map.set(value,(map.get(value)??0)+1));return [...map.entries()].sort((a,b)=>b[1]-a[1]);};
  const genres=countValues(watchedMovies.map((movie)=>movie.genres)).slice(0,8);
  const directors=countValues(watchedMovies.map((movie)=>movie.directors)).slice(0,6);
  const maxGenre=Math.max(1,...genres.map(([,count])=>count));
  return <main className="page-shell space-y-12"><header className="grid gap-6 lg:grid-cols-[1fr_auto]"><div><p className="eyebrow">Inteligência de visualização pessoal</p><h1 className="display-title mt-3 text-5xl sm:text-7xl">Estatísticas e insights.</h1><p className="mt-4 max-w-2xl leading-7 text-slate-400">Uma visão real do arquivo: o que você assiste, como você avalia e para onde sua atenção sempre retorna.</p><Link href="#taste" className="accent-button mt-6">Explore seu DNA cinematográfico ↓</Link></div><p className="self-end text-xs font-bold text-slate-600">Gerado diretamente do PostgreSQL · {logs.length} eventos</p></header>
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-6"><Stat label="Total de sessões" value={logs.length}/><Stat label="Filmes assistidos" value={watchedMovies.length}/><Stat label="Nota média" value={rated.length?average.toFixed(2):"—"} accent/><Stat label="Resenhas" value={logs.filter((log)=>log.review?.trim()).length}/><Stat label="Reexibições" value={logs.filter((log)=>log.rewatch).length}/><Stat label="Entradas avaliadas" value={rated.length}/></section>
    <section className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]"><div className="surface rounded-[1.75rem] p-5 sm:p-7"><div><p className="eyebrow">Ao longo do tempo</p><h2 className="section-heading mt-2">Ritmo de visualização.</h2></div>{monthSeries.length?<div className="mt-8 flex h-64 items-end gap-2 border-b border-white/[0.08] pb-1">{monthSeries.map(([key,count])=><div key={key} className="group flex h-full flex-1 flex-col items-center justify-end gap-2"><span className="text-[9px] font-black text-slate-500 opacity-0 transition group-hover:opacity-100">{count}</span><div className="w-full rounded-t-md bg-gradient-to-t from-amber-400/35 to-amber-300 transition group-hover:brightness-125" style={{height:`${Math.max(3,(count/maxMonth)*190)}px`}}/><span className="-rotate-45 whitespace-nowrap text-[8px] font-bold text-slate-600 sm:rotate-0">{new Intl.DateTimeFormat("pt-BR",{month:"short",year:"2-digit",timeZone:"UTC"}).format(new Date(`${key}-01T12:00:00Z`))}</span></div>)}</div>:<Empty/>}</div>
      <div className="surface rounded-[1.75rem] p-5 sm:p-7"><p className="eyebrow">Sua escala</p><h2 className="section-heading mt-2">Distribuição de notas.</h2><div className="mt-7 space-y-3">{distribution.map((item)=><div key={item.rating} className="grid grid-cols-[2.4rem_1fr_2rem] items-center gap-3"><span className="text-xs font-black text-amber-200">{item.rating.toFixed(1)}</span><div className="h-2.5 overflow-hidden rounded-full bg-white/[0.05]"><div className="h-full rounded-full bg-amber-300/70" style={{width:`${(item.count/maxRating)*100}%`}}/></div><span className="text-right text-xs font-bold tabular-nums text-slate-600">{item.count}</span></div>)}</div></div></section>
    <section className="grid gap-5 lg:grid-cols-2"><div className="surface rounded-[1.75rem] p-5 sm:p-7"><p className="eyebrow">Climas recorrentes</p><h2 className="section-heading mt-2">Gêneros favoritos.</h2><div className="mt-7 space-y-3">{genres.length?genres.map(([genre,count],index)=><div key={genre}><div className="mb-1.5 flex items-center justify-between text-xs"><span className="font-bold text-slate-300"><span className="mr-2 text-amber-300/50">{String(index+1).padStart(2,"0")}</span>{genre}</span><span className="text-slate-600">{count} filmes</span></div><div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]"><div className="h-full rounded-full bg-amber-300/70" style={{width:`${(count/maxGenre)*100}%`}}/></div></div>):<Empty/>}</div></div><div className="surface rounded-[1.75rem] p-5 sm:p-7"><p className="eyebrow">Atrás das câmeras</p><h2 className="section-heading mt-2">Diretores mais assistidos.</h2>{directors.length?<ol className="mt-6 divide-y divide-white/[0.07]">{directors.map(([director,count],index)=><li key={director} className="flex items-center gap-4 py-3"><span className="text-xl font-black text-violet-300/50">{String(index+1).padStart(2,"0")}</span><span className="flex-1 text-sm font-bold text-white">{director}</span><span className="text-xs text-slate-500">{count} filmes</span></li>)}</ol>:<div className="empty-state mt-6 !py-8"><p className="text-sm text-slate-500">As informações de diretores aparecem à medida que os créditos do TMDb são atualizados nas páginas dos filmes.</p></div>}</div></section>
    <TasteExplorer initialData={tasteData} />
    <section><div className="mb-5 flex items-end justify-between"><div><p className="eyebrow">A prateleira de elite</p><h2 className="section-heading mt-2">Filmes mais bem avaliados.</h2></div><Link href="/diary" className="text-sm font-bold text-amber-300">Abrir diário →</Link></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">{highestRated.map((movie)=><MovieCard key={movie.id} movie={movie}/>)}</div></section>
  </main>;
}

function Stat({label,value,accent=false}:{label:string;value:string|number;accent?:boolean}) { return <div className="surface-subtle rounded-2xl p-4 sm:p-5"><p className="text-[9px] font-black uppercase tracking-[.14em] text-slate-600">{label}</p><p className={`mt-2 text-3xl font-black tabular-nums ${accent?"text-amber-200":"text-white"}`}>{value}</p></div>; }
function Empty(){return <p className="py-8 text-sm text-slate-600">Dados insuficientes ainda.</p>}
