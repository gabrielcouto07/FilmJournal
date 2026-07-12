import MovieSearch from "@/components/MovieSearch";

export default function SearchPage() {
  return (
    <main className="page-shell max-w-5xl">
      <header className="mb-9 max-w-2xl">
        <p className="eyebrow">Discover</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-.045em] text-white sm:text-6xl">Find the next frame.</h1>
        <p className="mt-4 text-base leading-7 text-slate-400">A focused TMDb search built for keeping your private archive clean, current, and genuinely yours.</p>
      </header>
      <MovieSearch />
    </main>
  );
}
