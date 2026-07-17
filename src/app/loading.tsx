export default function Loading() {
  return <main className="page-shell" aria-label="Carregando página"><div className="shimmer h-9 w-36 rounded-lg"/><div className="shimmer mt-5 h-20 max-w-3xl rounded-2xl"/><div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">{Array.from({length:14},(_,index)=><div key={index} className="shimmer aspect-[2/3.55] rounded-[1.15rem]"/>)}</div></main>;
}
