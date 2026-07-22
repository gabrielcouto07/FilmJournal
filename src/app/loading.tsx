export default function Loading() {
  return <main className="page-shell space-y-12" aria-label="Carregando seu paladar">
    {/* Hero verdict skeleton */}
    <div className="shimmer h-72 rounded-[2rem] sm:h-80" />
    {/* Dashboard section skeletons */}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">{Array.from({ length: 6 }, (_, index) => <div key={index} className="shimmer h-24 rounded-2xl" />)}</div>
    <div className="shimmer h-[26rem] rounded-[1.75rem]" />
    <div className="grid gap-5 lg:grid-cols-2"><div className="shimmer h-80 rounded-[1.75rem]" /><div className="shimmer h-80 rounded-[1.75rem]" /></div>
  </main>;
}
