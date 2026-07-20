import Link from "next/link";
import DiaryExplorer from "@/components/DiaryExplorer";
import { getCurrentUser } from "@/lib/auth";
import { getDiaryData } from "@/lib/data";

export default async function DiaryPage() {
  const viewer = await getCurrentUser();
  const { entries, reviews, rewatches } = await getDiaryData(viewer?.id ?? "");

  return <main className="page-shell">
    <header className="mb-8 grid gap-6 lg:grid-cols-[1fr_auto]"><div><p className="eyebrow">Arquivo cronológico</p><h1 className="display-title mt-3 text-5xl sm:text-7xl">Seu diário, em movimento.</h1><p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">Cada sessão registrada, agora separada de forma clara das notas, curtidas e do estado do catálogo assistido.</p></div><div className="grid grid-cols-3 gap-2 self-end"><Stat label="Entradas" value={entries.length} accent /><Stat label="Resenhas" value={reviews} /><Stat label="Reexibições" value={rewatches} /></div></header>
    {entries.length ? <DiaryExplorer entries={entries} /> : <div className="empty-state"><p className="text-lg font-bold text-white">O diário está pronto para o seu primeiro quadro.</p><Link href="/search" className="accent-button mt-5">Descobrir um filme</Link></div>}
  </main>;
}

function Stat({label,value,accent=false}:{label:string;value:number;accent?:boolean}) { return <div className="surface-subtle min-w-24 rounded-2xl px-4 py-3 text-right"><p className="text-[9px] font-black uppercase tracking-wider text-slate-600">{label}</p><p className={`mt-1 text-2xl font-black tabular-nums ${accent?"text-amber-200":"text-white"}`}>{value}</p></div>; }
