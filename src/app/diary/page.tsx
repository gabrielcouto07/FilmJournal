import Link from "next/link";
import DiaryExplorer, { type DiaryItem } from "@/components/DiaryExplorer";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

import { getOwnerUser } from "@/lib/auth";

export default async function DiaryPage() {
  const owner = await getOwnerUser();
  const ownerId = owner?.id || "";

  const logs = await prisma.logEntry.findMany({
    where: { userId: ownerId },
    include: { movie: { select: { id:true,title:true,year:true,genres:true,posterPath:true,preferredPosterPath:true } } },
    orderBy: [{ watchedAt: "desc" }, { loggedAt: "desc" }],
  });

  const movieIds = logs.map((l) => l.movieId);
  const userMovies = await prisma.userMovie.findMany({
    where: { userId: ownerId, movieId: { in: movieIds } }
  });
  const umMap = new Map(userMovies.map((um) => [um.movieId, um]));

  const entries: DiaryItem[] = logs.map((log) => ({
    ...log,
    watchedAt: log.watchedAt?.toISOString() ?? null,
    loggedAt: log.loggedAt?.toISOString() ?? null,
    movie: {
      ...log.movie,
      favorite: umMap.get(log.movieId)?.favorite ?? false
    }
  }));
  const reviews = logs.filter((log) => log.review?.trim()).length;
  const rewatches = logs.filter((log) => log.rewatch).length;
  return <main className="page-shell">
    <header className="mb-8 grid gap-6 lg:grid-cols-[1fr_auto]"><div><p className="eyebrow">Arquivo cronológico</p><h1 className="display-title mt-3 text-5xl sm:text-7xl">Seu diário, em movimento.</h1><p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">Cada sessão registrada, agora separada de forma clara das notas, curtidas e do estado do catálogo assistido.</p></div><div className="grid grid-cols-3 gap-2 self-end"><Stat label="Entradas" value={logs.length} accent /><Stat label="Resenhas" value={reviews} /><Stat label="Reexibições" value={rewatches} /></div></header>
    {entries.length ? <DiaryExplorer entries={entries} /> : <div className="empty-state"><p className="text-lg font-bold text-white">O diário está pronto para o seu primeiro quadro.</p><Link href="/search" className="accent-button mt-5">Descobrir um filme</Link></div>}
  </main>;
}

function Stat({label,value,accent=false}:{label:string;value:number;accent?:boolean}) { return <div className="surface-subtle min-w-24 rounded-2xl px-4 py-3 text-right"><p className="text-[9px] font-black uppercase tracking-wider text-slate-600">{label}</p><p className={`mt-1 text-2xl font-black tabular-nums ${accent?"text-amber-200":"text-white"}`}>{value}</p></div>; }
