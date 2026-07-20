import LetterboxdImport from "@/components/LetterboxdImport";

export const metadata = {
  title: "Importar do Letterboxd — FilmJournal",
};

export const dynamic = "force-dynamic";

const STEPS = [
  {
    title: "Exporte seus dados",
    body: "No Letterboxd: Settings → Data → “Export your data”. Você recebe um arquivo .zip.",
  },
  {
    title: "Envie o .zip aqui",
    body: "Arraste o arquivo .zip inteiro abaixo — não precisa descompactar. Se preferir, envie os .csv soltos.",
  },
  {
    title: "Pronto",
    body: "Seu diário, notas, resenhas, watchlist e favoritos aparecem na sua conta na hora.",
  },
];

const FILES = [
  { name: "diary.csv", desc: "Sessões com data, incluindo reexibições." },
  { name: "reviews.csv", desc: "Resenhas escritas em cada sessão." },
  { name: "ratings.csv", desc: "Suas notas (0,5–5 estrelas)." },
  { name: "watched.csv", desc: "Todos os filmes marcados como vistos." },
  { name: "watchlist.csv", desc: "Filmes que você quer assistir." },
  { name: "likes/films.csv", desc: "Filmes curtidos (favoritos)." },
];

export default function ImportPage() {
  return (
    <main className="page-shell max-w-4xl space-y-10">
      <section className="surface relative overflow-hidden rounded-[2rem] p-8 sm:p-12">
        <div className="glass-gradient absolute inset-0 -z-10" />
        <p className="eyebrow">Onboarding</p>
        <h1 className="display-title mt-4 text-4xl sm:text-6xl">Importar do Letterboxd</h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300">
          Traga toda a sua história do Letterboxd para o FilmJournal em um único envio — filmes vistos,
          notas, diário, resenhas, watchlist e favoritos, tudo ligado à sua conta.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <div key={step.title} className="surface-subtle rounded-2xl p-5">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-amber-300 text-sm font-black text-[#1a1400]">{index + 1}</span>
            <h2 className="mt-4 text-sm font-black text-white">{step.title}</h2>
            <p className="mt-2 text-xs leading-5 text-slate-400">{step.body}</p>
          </div>
        ))}
      </section>

      <LetterboxdImport />

      <section>
        <h2 className="section-heading mb-4">O que é lido do seu export</h2>
        <div className="surface rounded-2xl divide-y divide-white/[0.06]">
          {FILES.map((file) => (
            <div key={file.name} className="flex items-center gap-4 p-4">
              <code className="shrink-0 rounded-md border border-white/10 bg-black/30 px-2.5 py-1 text-xs font-bold text-amber-200">{file.name}</code>
              <span className="text-sm text-slate-400">{file.desc}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-600">
          Enviar o mesmo arquivo de novo é seguro — as entradas existentes são reconciliadas, não duplicadas. O envio web aceita até 4 MB.
        </p>
      </section>
    </main>
  );
}
