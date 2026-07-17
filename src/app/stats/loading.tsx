export default function StatsLoading() {
  return <main className="page-shell space-y-8" aria-label="Carregando estatísticas e perfil de gosto">
    <div className="shimmer h-40 rounded-[2rem]" />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">{Array.from({ length: 6 }, (_, index) => <div key={index} className="shimmer h-24 rounded-2xl" />)}</div>
    <div className="grid gap-5 lg:grid-cols-2"><div className="shimmer h-80 rounded-[1.75rem]" /><div className="shimmer h-80 rounded-[1.75rem]" /></div>
    <div className="shimmer h-[32rem] rounded-[2rem]" />
  </main>;
}
