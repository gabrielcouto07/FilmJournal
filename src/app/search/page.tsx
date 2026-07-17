import MovieSearch from "@/components/MovieSearch";

export const dynamic = "force-dynamic";

export default function SearchPage() {
  return (
    <main className="page-shell">
      <header className="mb-9 max-w-3xl">
        <p className="eyebrow">Descobrir</p>
        <h1 className="display-title mt-3 text-5xl sm:text-7xl">Encontre o próximo quadro.</h1>
        <p className="mt-4 text-base leading-7 text-slate-400">Busque, explore trilhos curados ao vivo e adicione à lista, favorite ou registre um filme sem interromper o fluxo.</p>
      </header>
      <MovieSearch />
    </main>
  );
}
