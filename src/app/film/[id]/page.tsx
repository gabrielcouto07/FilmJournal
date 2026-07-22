import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import CollectionControls from "@/components/CollectionControls";
import LogEditor from "@/components/LogEditor";
import MovieRatingControl from "@/components/MovieRatingControl";
import PosterPicker from "@/components/PosterPicker";
import StarRating from "@/components/StarRating";
import BackgroundEnrich from "@/components/BackgroundEnrich";
import { getBackdropUrl, movieBackdropPath, moviePosterPath } from "@/lib/tmdb";
import { prisma } from "@/lib/prisma";

import { getCurrentUser } from "@/lib/auth";

// A leitura da sessão já faz esta página ser renderizada por requisição.
type Props={params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>};
function formatDate(date:Date|null){return date?new Intl.DateTimeFormat("pt-BR",{day:"numeric",month:"long",year:"numeric",timeZone:"UTC"}).format(date):"Data não registrada";}

export default async function FilmPage({params,searchParams}:Props){
  const {id}=await params;
  const autoLog=(await searchParams).log==="1";
  const viewer = await getCurrentUser();
  const ownerId = viewer?.id || "";

  // Traz o estado do usuário na mesma consulta.
  const movie = await prisma.movie.findUnique({
    where: { id },
    include: {
      logs: { where: { userId: ownerId }, orderBy: [{ watchedAt: "desc" as const }, { loggedAt: "desc" as const }] },
      userMovies: { where: { userId: ownerId } },
    },
  });
  if (!movie) notFound();
  // Os dados do TMDB são completados em segundo plano, sem travar a página.
  const needsMetadata = !movie.tmdbId || !movie.directors || !movie.cast || movie.tmdbRating == null;

  const userMovie = movie.userMovies[0] ?? null;

  const enrichedMovie = {
    ...movie,
    rating: userMovie?.rating ?? null,
    watched: userMovie?.watched ?? false,
    favorite: userMovie?.favorite ?? false,
    watchlist: userMovie?.watchlist ?? false,
    watchlistAddedAt: userMovie?.watchlistAddedAt ?? null,
    favoriteRank: userMovie?.favoriteRank ?? null
  };

  const logs=enrichedMovie.logs;
  const latest=logs[0];
  const latestReview=logs.find((log)=>log.review?.trim());
  const backdrop=getBackdropUrl(movieBackdropPath(enrichedMovie));
  const selectedPoster=moviePosterPath(enrichedMovie);
  const imdbUrl=enrichedMovie.imdbId?`https://www.imdb.com/title/${enrichedMovie.imdbId}/`:null;
  const letterboxdUrl=enrichedMovie.letterboxdUri;
  return <main className="page-shell max-w-[1380px]">
    <BackgroundEnrich movieIds={[movie.id]} when={needsMetadata} />
    <div className="mb-5 flex items-center justify-between"><Link href="/diary" className="text-sm font-bold text-amber-300 hover:text-amber-200">← Voltar ao diário</Link><p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Ficha do filme · {movie.tmdbId?`TMDb ${movie.tmdbId}`:"Arquivo local"}</p></div>
    <section className="surface relative isolate overflow-hidden rounded-[2rem] p-5 sm:p-8 lg:p-10">{backdrop&&<div className="absolute inset-0 -z-20 scale-105 bg-cover bg-center opacity-60" style={{backgroundImage:`url(${backdrop})`}}/>}<div className="glass-gradient absolute inset-0 -z-10"/><div className="grid gap-9 lg:min-h-[34rem] lg:grid-cols-[minmax(18rem,.72fr)_minmax(0,1.28fr)] lg:items-center lg:gap-12"><div className="relative flex items-center justify-center lg:h-full"><div className="absolute h-3/4 w-3/4 rounded-full bg-amber-300/[0.08] blur-[70px]"/><PosterPicker movieId={enrichedMovie.id} tmdbId={enrichedMovie.tmdbId} initialPosterPath={selectedPoster} defaultPosterPath={enrichedMovie.posterPath} initialBackdropPath={movieBackdropPath(enrichedMovie)} title={enrichedMovie.title}/></div><div className="min-w-0 max-w-3xl pb-2 lg:py-8"><p className="eyebrow">{enrichedMovie.directors?`Um filme de ${enrichedMovie.directors}`:"Arquivo pessoal de filmes"}</p><h1 className="display-title balance mt-3 text-5xl leading-[.95] sm:text-7xl lg:text-8xl">{enrichedMovie.title}</h1><p className="mt-4 text-sm font-bold text-amber-200">{[enrichedMovie.year,enrichedMovie.runtime?`${enrichedMovie.runtime} min`:null,enrichedMovie.genres].filter(Boolean).join(" · ")}</p>{enrichedMovie.tagline&&<p className="mt-5 text-xl italic text-slate-200">“{enrichedMovie.tagline}”</p>}<p className="mt-5 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">{enrichedMovie.overview||"Nenhuma sinopse foi adicionada ainda."}</p><div className="mt-7 flex flex-wrap gap-3"><LogEditor movieId={enrichedMovie.id} title={enrichedMovie.title} initialRating={enrichedMovie.rating} initialRewatch={enrichedMovie.watched} initialFavorite={enrichedMovie.favorite} autoOpen={autoLog} /><CollectionControls movieId={enrichedMovie.id} initialWatchlist={enrichedMovie.watchlist} initialFavorite={enrichedMovie.favorite} initialFavoriteRank={enrichedMovie.favoriteRank}/></div></div></div></section>
    <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Info label="Sua Nota"><MovieRatingControl movieId={enrichedMovie.id} initialRating={enrichedMovie.rating}/></Info><Info label="Histórico de sessões"><p className="text-2xl font-black text-white">{logs.length} <span className="text-xs font-bold text-slate-500">{logs.length===1?"sessão":"sessões"}</span></p></Info><Info label="Nota TMDb"><p className="text-2xl font-black text-blue-200">{enrichedMovie.tmdbRating?enrichedMovie.tmdbRating.toFixed(1):"—"} <span className="text-xs font-bold text-slate-500">/ 10{enrichedMovie.tmdbVoteCount?` · ${enrichedMovie.tmdbVoteCount.toLocaleString()} votos`:""}</span></p></Info><Info label="Fontes externas"><div className="flex gap-3 text-sm font-bold text-amber-200">{imdbUrl&&<a href={imdbUrl} target="_blank" rel="noreferrer">IMDb ↗</a>}{letterboxdUrl&&<a href={letterboxdUrl} target="_blank" rel="noreferrer">Letterboxd ↗</a>}{!imdbUrl&&!letterboxdUrl&&<span className="text-slate-600">Nenhum link disponível</span>}</div></Info></section>
    <section className="mt-12 grid gap-10 lg:grid-cols-[1.3fr_.7fr]"><div>{latestReview?<><p className="eyebrow">Do seu diário</p><h2 className="section-heading mt-2">A anotação que ficou.</h2><article className="surface relative mt-5 overflow-hidden rounded-[1.75rem] p-6 sm:p-8"><span className="absolute -right-2 -top-10 text-[10rem] font-serif leading-none text-amber-300/[0.045]">“</span><p className="relative whitespace-pre-wrap text-base leading-8 text-slate-200 sm:text-lg">{latestReview.review}</p><div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-4"><div><p className="text-xs font-bold text-slate-500">{formatDate(latestReview.watchedAt??latestReview.loggedAt)}{latestReview.rewatch?" · Reexibição":""}</p>{latestReview.rating!=null&&<div className="mt-2"><StarRating value={latestReview.rating} readOnly showValue/></div>}</div><LogEditor movieId={enrichedMovie.id} title={enrichedMovie.title} logId={latestReview.id} initialDate={(latestReview.watchedAt??latestReview.loggedAt)?.toISOString().slice(0,10)} initialRating={latestReview.rating} initialReview={latestReview.review} initialRewatch={latestReview.rewatch} initialTags={latestReview.tags} initialFavorite={enrichedMovie.favorite} label="Editar resenha" compact/></div></article></>:<div className="empty-state"><p className="text-lg font-bold text-white">Nenhuma anotação escrita ainda.</p><p className="mt-2 text-sm text-slate-500">Registre uma sessão e capture o que ficou com você.</p><div className="mt-5"><LogEditor movieId={enrichedMovie.id} title={enrichedMovie.title} initialRating={enrichedMovie.rating} initialFavorite={enrichedMovie.favorite}/></div></div>}</div><aside><p className="eyebrow">Créditos</p><h2 className="section-heading mt-2">Pessoas em cena.</h2><div className="mt-5 space-y-5"><div><p className="text-[10px] font-black uppercase tracking-wider text-slate-600">Diretor</p><p className="mt-2 text-sm font-bold text-white">{enrichedMovie.directors||"Não disponível"}</p></div><div><p className="text-[10px] font-black uppercase tracking-wider text-slate-600">Elenco principal</p><div className="mt-2 flex flex-wrap gap-2">{enrichedMovie.cast?enrichedMovie.cast.split(",").map((person)=><span key={person} className="chip">{person.trim()}</span>):<p className="text-sm text-slate-600">Não disponível</p>}</div></div></div></aside></section>
    <section className="mt-12"><div className="mb-5 flex items-end justify-between"><div><p className="eyebrow">Histórico de sessões</p><h2 className="section-heading mt-2">Cada retorno.</h2></div>{latest&&<LogEditor movieId={enrichedMovie.id} title={enrichedMovie.title} logId={latest.id} initialDate={(latest.watchedAt??latest.loggedAt)?.toISOString().slice(0,10)} initialRating={latest.rating} initialReview={latest.review} initialRewatch={latest.rewatch} initialTags={latest.tags} initialFavorite={enrichedMovie.favorite} label="Editar recente" compact/>}</div>{logs.length?<div className="relative space-y-3 before:absolute before:bottom-6 before:left-[1.15rem] before:top-6 before:w-px before:bg-white/[0.08]">{logs.map((log,index)=><article key={log.id} className="surface-subtle relative ml-10 rounded-2xl p-5 before:absolute before:-left-[1.5rem] before:top-6 before:h-3 before:w-3 before:rounded-full before:border-2 before:border-[#080b09] before:bg-amber-300"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-slate-500">{formatDate(log.watchedAt??log.loggedAt)} {log.rewatch?"· Reexibição":""}</p>{log.rating!=null&&<div className="mt-2"><StarRating value={log.rating} readOnly showValue/></div>}</div><span className="text-xs font-bold text-slate-700">#{logs.length-index}</span></div>{log.review&&log.id!==latestReview?.id&&<p className="mt-4 line-clamp-3 text-sm leading-7 text-slate-400">{log.review}</p>}</article>)}</div>:<p className="text-sm text-slate-600">Este filme está no arquivo, mas ainda não tem nenhuma sessão registrada.</p>}</section>
  </main>;
}
function Info({label,children}:{label:string;children:ReactNode}){return <div className="surface-subtle rounded-2xl p-4"><p className="eyebrow !text-slate-600">{label}</p><div className="mt-2">{children}</div></div>}
