import Link from "next/link";
import { getPosterUrl } from "@/lib/tmdb";
import type { CardMovie } from "@/lib/types";
import ArtworkImage from "./ArtworkImage";
import StarRating from "./StarRating";

// Aceita tanto objetos do Prisma quanto dados serializados do cache.
type CardLogInfo = { rating: number | null; rewatch: boolean };
type Props = { movie: CardMovie; log?: CardLogInfo | null; priority?: boolean; rank?: number };

export default function MovieCard({ movie, log, priority = false, rank }: Props) {
  const preferredPosterUrl = getPosterUrl(movie.preferredPosterPath);
  const defaultPosterUrl = getPosterUrl(movie.posterPath);
  const rating = log?.rating ?? movie.rating;
  return <article className="poster-card group relative min-w-0 overflow-hidden rounded-[1.15rem] border border-white/[0.09] bg-[#141414]">
    <Link href={`/film/${movie.id}`} className="block">
      <div className="relative aspect-[2/3] overflow-hidden bg-[#18201b]">
        <ArtworkImage src={preferredPosterUrl} fallbackSrc={defaultPosterUrl} alt={`Pôster de ${movie.title}`} title={movie.title} className="h-full w-full" eager={priority} sizes="(max-width: 640px) 36vw, (max-width: 1024px) 22vw, 192px" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#090c0a] via-[#090c0a]/25 to-transparent" />
        {(rank ?? movie.favoriteRank) != null && <span className="absolute left-2.5 top-2.5 rounded-full border border-amber-200/25 bg-black/70 px-2 py-1 text-[9px] font-black tracking-[.12em] text-amber-100 backdrop-blur">#{rank ?? movie.favoriteRank}</span>}
        {movie.favorite && <span className="absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-full border border-amber-200/25 bg-black/70 text-xs text-amber-200 backdrop-blur" aria-label="Filme favorito">♥</span>}
        {rating != null && <div className="absolute bottom-2.5 left-2.5 rounded-full border border-white/10 bg-black/60 px-2 py-1 backdrop-blur"><StarRating value={rating} readOnly size="sm" /></div>}
      </div>
      <div className="p-3.5">
        <h2 className="truncate text-sm font-extrabold tracking-tight text-white">{movie.title}</h2>
        <div className="mt-1.5 flex items-center justify-between text-[11px] font-semibold text-slate-500"><span>{movie.year ?? "Ano desconhecido"}</span>{log?.rewatch && <span className="text-amber-300">↻ Reexibição</span>}</div>
      </div>
    </Link>
  </article>;
}
