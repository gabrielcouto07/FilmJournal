import Link from "next/link";

export const metadata = {
  title: "Letterboxd Import — FilmJournal",
};

const STEPS = [
  {
    title: "Open your Letterboxd data settings",
    body: "Go to letterboxd.com → Settings → Data (or visit letterboxd.com/data/export while signed in).",
  },
  {
    title: "Export your data",
    body: "Click “Export your data”. Letterboxd emails/serves a ZIP archive of your account.",
  },
  {
    title: "Unzip the archive",
    body: "Inside you’ll find the CSV files this importer reads.",
  },
];

const FILES = [
  { name: "watched.csv", desc: "Every film you’ve marked as watched." },
  { name: "ratings.csv", desc: "Your star ratings (0.5–5)." },
  { name: "diary.csv", desc: "Dated diary entries, including rewatches." },
  { name: "reviews.csv", desc: "Written reviews attached to watches." },
  { name: "watchlist.csv", desc: "Films you want to watch." },
];

export default function ImportPage() {
  return (
    <main className="page-shell max-w-4xl space-y-10">
      <section className="surface relative overflow-hidden rounded-[2rem] p-8 sm:p-12">
        <div className="glass-gradient absolute inset-0 -z-10" />
        <p className="eyebrow">Phase 2 · Onboarding</p>
        <h1 className="display-title mt-4 text-4xl sm:text-6xl">Letterboxd Import</h1>
        <span className="mt-5 inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-amber-200">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-300" /> Coming Soon
        </span>
        <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300">
          Soon you’ll be able to bring your entire Letterboxd history into FilmJournal in one upload —
          your watched films, ratings, diary, reviews, and watchlist, resolved against TMDB and scoped to your account.
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

      <section>
        <h2 className="section-heading mb-4">The files you’ll upload</h2>
        <div className="surface rounded-2xl divide-y divide-white/[0.06]">
          {FILES.map((file) => (
            <div key={file.name} className="flex items-center gap-4 p-4">
              <code className="shrink-0 rounded-md border border-white/10 bg-black/30 px-2.5 py-1 text-xs font-bold text-amber-200">{file.name}</code>
              <span className="text-sm text-slate-400">{file.desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* TODO: Phase 2 - build the upload form here and POST the CSVs to
          /api/import/letterboxd (multipart/form-data), then render the
          { imported, skipped, errors } summary the route returns. */}
      <div className="empty-state">
        <p className="font-bold text-white">The upload experience is under construction.</p>
        <Link href="/" className="mt-3 inline-flex text-xs font-bold text-amber-300">Back to overview →</Link>
      </div>
    </main>
  );
}
