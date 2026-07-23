import Link from "next/link";
import { getBackdropUrl, getPosterUrl, getTmdbFeed, type TmdbMovieSearchResult } from "@/lib/tmdb";
import ArtworkImage from "./ArtworkImage";

// Página pública renderizada no servidor, sem expor a chave do TMDB.

const FEATURES = [
  { icon: "🗺️", title: "Mapa de gosto", body: "Veja onde seu gosto pousa por década, país, gênero e duração — o retrato real do que você assiste." },
  { icon: "🌊", title: "Você contra a maré", body: "Quantifique sua distância do consenso e descubra os filmes em que você discorda do mundo." },
  { icon: "🕳️", title: "Motor de pontos cegos", body: "Sugestões aclamadas exatamente onde seu mapa está em branco — e cada uma explica por que apareceu." },
  { icon: "🎭", title: "Jogo do elenco", body: "Adivinhe o filme pelo elenco, com pontuação e sequências — gerado do seu próprio arquivo." },
  { icon: "🎲", title: "Roleta com intenção", body: "Sem decidir o que ver? Diga o clima e deixe a roleta escolher com critério." },
  { icon: "🎬", title: "Import do Letterboxd", body: "Traga todo o seu histórico em minutos e veja as análises nascerem prontas." },
];

const HERO_TAGS = ["Mapa de gosto", "Análise contrarian", "Pontos cegos", "Jogo do elenco", "Roleta", "Import Letterboxd"];

async function getTrending(): Promise<TmdbMovieSearchResult[]> {
  try {
    const feed = await getTmdbFeed("trending");
    return feed.results.filter((movie) => movie.poster_path).slice(0, 12);
  } catch {
    // A página continua funcionando mesmo se o TMDB falhar.
    return [];
  }
}

export default async function PublicOverview() {
  const trending = await getTrending();
  const heroBackdrop = getBackdropUrl(trending.find((movie) => movie.backdrop_path)?.backdrop_path ?? null);

  return <main className="page-shell space-y-16">
    {/* Apresentação */}
    <section className="fade-up surface relative isolate min-h-[30rem] overflow-hidden rounded-[2rem] p-6 sm:p-12 lg:p-16">
      {heroBackdrop && <div className="absolute inset-0 -z-20 bg-cover bg-center opacity-40" style={{ backgroundImage: `url(${heroBackdrop})` }} />}
      <div className="glass-gradient absolute inset-0 -z-10" />
      <div className="flex min-h-[24rem] max-w-3xl flex-col justify-center">
        <p className="eyebrow">FilmJournal · Cartografia do gosto</p>
        <h1 className="display-title balance mt-5 text-5xl leading-[.95] sm:text-7xl">Seu gosto, mapeado.</h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
          Análises pessoais de cinema: mapeie seu gosto por década, geografia e gênero, meça sua
          distância do consenso da crítica e receba sugestões que expandem seus pontos cegos —
          tudo calculado do seu próprio histórico.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Link href="/login?tab=register" className="accent-button glow-pulse px-6 py-3.5 text-sm font-black">
            Crie sua conta e mapeie seu gosto →
          </Link>
          <Link href="/login" className="quiet-button px-5 py-3.5">Já tenho conta · Entrar</Link>
        </div>
        <div className="mt-8 flex flex-wrap gap-2">
          {HERO_TAGS.map((tag) => <span key={tag} className="chip">{tag}</span>)}
        </div>
      </div>
    </section>

    {/* Em alta na semana */}
    <section className="fade-up fade-up-1">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Em alta esta semana</p>
          <h2 className="section-heading mt-2">Populares esta semana.</h2>
        </div>
        <Link href="/login?tab=register" className="shrink-0 text-xs font-bold text-amber-300 hover:text-amber-200 sm:text-sm">
          Comece a mapear →
        </Link>
      </div>
      {trending.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {trending.map((movie, index) => <TrendingCard key={movie.id} movie={movie} priority={index < 6} />)}
        </div>
      ) : (
        <div className="empty-state">
          <p className="font-bold text-white">Os destaques da semana estão indisponíveis no momento.</p>
          <p className="mt-2 text-sm text-slate-400">Crie sua conta para começar a montar seu próprio acervo.</p>
          <Link href="/login?tab=register" className="accent-button mt-5">Criar conta →</Link>
        </div>
      )}
    </section>

    {/* Recursos principais */}
    <section className="fade-up fade-up-2">
      <div className="mb-6">
        <p className="eyebrow">O que o FilmJournal revela</p>
        <h2 className="section-heading mt-2">Análises que nenhuma prateleira genérica entrega.</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <div key={feature.title} className="surface-subtle rounded-2xl p-6">
            <span className="grid h-11 w-11 place-items-center rounded-full border border-amber-300/25 bg-amber-300/10 text-lg" aria-hidden="true">{feature.icon}</span>
            <h3 className="mt-4 text-base font-black text-white">{feature.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">{feature.body}</p>
          </div>
        ))}
      </div>
    </section>

    {/* Chamada final */}
    <section className="fade-up fade-up-3 surface relative overflow-hidden rounded-[2rem] p-8 text-center sm:p-14">
      <div className="glass-gradient absolute inset-0 -z-10" />
      <h2 className="display-title balance mx-auto max-w-2xl text-4xl sm:text-5xl">Comece a mapear seu gosto hoje.</h2>
      <p className="mx-auto mt-5 max-w-xl text-slate-300">
        Crie sua conta gratuitamente — e, se já usa o Letterboxd, importe o histórico e veja seu
        mapa de gosto pronto em minutos.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href="/login?tab=register" className="accent-button px-6 py-3.5 text-sm font-black">Criar minha conta →</Link>
        <Link href="/login" className="quiet-button px-5 py-3.5">Entrar</Link>
      </div>
    </section>
  </main>;
}

function TrendingCard({ movie, priority }: { movie: TmdbMovieSearchResult; priority?: boolean }) {
  const year = movie.release_date ? movie.release_date.slice(0, 4) : null;
  const poster = getPosterUrl(movie.poster_path);
  const rating = typeof movie.vote_average === "number" && movie.vote_average > 0 ? movie.vote_average.toFixed(1) : null;

  return <Link
    href="/login?tab=register"
    className="poster-card group relative block min-w-0 overflow-hidden rounded-[1.15rem] border border-white/[0.09] bg-[#141414]"
    aria-label={`${movie.title} — crie sua conta para acompanhar`}
  >
    <div className="relative aspect-[2/3] overflow-hidden bg-[#18201b]">
      <ArtworkImage src={poster} alt={`Pôster de ${movie.title}`} title={movie.title} className="h-full w-full" eager={priority} sizes="(max-width: 640px) 45vw, (max-width: 1024px) 24vw, 200px" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#090c0a] via-[#090c0a]/25 to-transparent" />
      {rating && <div className="absolute left-2.5 top-2.5 rounded-full border border-amber-200/25 bg-black/70 px-2 py-1 text-[10px] font-black text-amber-100 backdrop-blur">★ {rating}</div>}
    </div>
    <div className="p-3.5">
      <h3 className="truncate text-sm font-extrabold tracking-tight text-white">{movie.title}</h3>
      <p className="mt-1.5 text-[11px] font-semibold text-slate-500">{year ?? "—"}</p>
    </div>
  </Link>;
}
