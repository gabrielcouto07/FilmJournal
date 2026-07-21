import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { prisma } from "@/lib/prisma";
import { searchTmdbMovies, TmdbError, type TmdbMovieSearchResult } from "@/lib/tmdb";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(rootDirectory, ".env.local") });
config({ path: path.join(rootDirectory, ".env") });

const BATCH_SIZE = 6;
const BATCH_PAUSE_MS = 200;
const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000];
const SAMPLE_LIMIT = 25;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Fold accents, drop punctuation, collapse whitespace, lowercase. */
function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      const status = error instanceof TmdbError ? error.status : 0;
      const retriable = status === 429 || status === 502 || status === 503;
      if (!retriable || attempt >= RETRY_DELAYS_MS.length) throw error;
      const wait = RETRY_DELAYS_MS[attempt];
      console.warn(`  ${label}: TMDB ${status} â€” retrying in ${wait}ms (attempt ${attempt + 1}/${RETRY_DELAYS_MS.length})`);
      await sleep(wait);
    }
  }
}

type MovieRef = { id: string; title: string; year: number | null };
type Match = { result: TmdbMovieSearchResult; strong: boolean };

/**
 * Choose a confident match only. A candidate qualifies when its title (or
 * original title) equals the query after normalization AND the release year is
 * within one year of ours. We never fall back to "first result" â€” a wrong id
 * would attribute another film's crowd rating to this one. When several strong
 * candidates exist (e.g. remakes), the highest vote_count wins, since that is
 * almost always the canonical entry.
 */
function chooseMatch(movie: MovieRef, results: TmdbMovieSearchResult[]): Match | null {
  const target = normalize(movie.title);
  if (!target) return null;

  const titleMatches = (candidate: TmdbMovieSearchResult) =>
    normalize(candidate.title) === target || normalize(candidate.original_title ?? "") === target;

  const yearMatches = (candidate: TmdbMovieSearchResult) => {
    if (movie.year == null) return true;
    const candidateYear = candidate.release_date ? Number(candidate.release_date.slice(0, 4)) : null;
    return candidateYear == null || Math.abs(candidateYear - movie.year) <= 1;
  };

  const strong = results.filter((candidate) => titleMatches(candidate) && yearMatches(candidate));
  if (strong.length === 0) return null;

  const best = strong.slice().sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0))[0];
  return { result: best, strong: true };
}

type Outcome =
  | { kind: "matched"; movie: MovieRef; result: TmdbMovieSearchResult }
  | { kind: "no-match"; movie: MovieRef }
  | { kind: "error"; movie: MovieRef; error: unknown };

/** Search TMDB for one film and classify the outcome. No DB writes here. */
async function resolveOne(movie: MovieRef): Promise<Outcome> {
  const query = movie.title.trim();
  if (query.length < 2) return { kind: "no-match", movie };
  try {
    const response = await withRetry(
      () => searchTmdbMovies(query, movie.year ?? undefined),
      movie.title,
    );
    const match = chooseMatch(movie, response.results);
    return match ? { kind: "matched", movie, result: match.result } : { kind: "no-match", movie };
  } catch (error) {
    return { kind: "error", movie, error };
  }
}

type Summary = {
  processed: number;
  resolved: number;
  noMatch: number;
  conflict: number;
  failed: number;
};

type SampleRow = { from: string; to: string };

async function run(options: { dryRun: boolean }): Promise<{ summary: Summary; samples: SampleRow[] }> {
  const movies = await prisma.movie.findMany({
    where: { tmdbId: null },
    select: { id: true, title: true, year: true },
    orderBy: [{ year: "desc" }, { title: "asc" }],
  });

  const summary: Summary = { processed: 0, resolved: 0, noMatch: 0, conflict: 0, failed: 0 };
  const samples: SampleRow[] = [];
  // tmdbIds assigned so far this run â€” guards against two local duplicates of
  // the same film both claiming one id (the column is unique).
  const claimed = new Set<number>();

  for (let index = 0; index < movies.length; index += BATCH_SIZE) {
    const batch = movies.slice(index, index + BATCH_SIZE);

    // Searches are read-only and safe to run concurrently.
    const outcomes = await Promise.all(batch.map(resolveOne));

    // Writes are sequential so the `claimed` guard and uniqueness check hold.
    for (const outcome of outcomes) {
      summary.processed += 1;
      if (outcome.kind === "error") {
        summary.failed += 1;
        console.warn(`  Search failed for ${outcome.movie.title}: ${outcome.error instanceof Error ? outcome.error.message : "unknown error"}`);
        continue;
      }
      if (outcome.kind === "no-match") {
        summary.noMatch += 1;
        continue;
      }

      const matchedId = outcome.result.id;
      const matchedYear = outcome.result.release_date ? outcome.result.release_date.slice(0, 4) : "â€”";
      const label = `${outcome.movie.title} (${outcome.movie.year ?? "?"})  â†’  ${outcome.result.title} (${matchedYear})  #${matchedId} Â· ${outcome.result.vote_count ?? 0} votes`;

      const takenLocally = claimed.has(matchedId);
      const takenInDb = takenLocally ? true : Boolean(await prisma.movie.findUnique({ where: { tmdbId: matchedId }, select: { id: true } }));
      if (takenInDb) {
        summary.conflict += 1;
        console.warn(`  Conflict (id already used): ${label}`);
        continue;
      }

      if (samples.length < SAMPLE_LIMIT) samples.push({ from: `${outcome.movie.title} (${outcome.movie.year ?? "?"})`, to: `${outcome.result.title} (${matchedYear}) Â· ${outcome.result.vote_count ?? 0} votes` });

      if (!options.dryRun) {
        await prisma.movie.update({ where: { id: outcome.movie.id }, data: { tmdbId: matchedId } });
      }
      claimed.add(matchedId);
      summary.resolved += 1;
    }

    console.log(`Progress: ${Math.min(index + batch.length, movies.length)}/${movies.length}`);
    if (index + BATCH_SIZE < movies.length) await sleep(BATCH_PAUSE_MS);
  }

  return { summary, samples };
}

function maskHost(host: string): string {
  const [first, ...rest] = host.split(".");
  const maskedFirst = !first || first.length <= 4 ? first : `${first.slice(0, 2)}â€¦${first.slice(-2)}`;
  return [maskedFirst, ...rest].join(".");
}

function describeDatabase(): { host: string; db: string } {
  const raw = process.env.DATABASE_URL ?? "";
  if (!raw) return { host: "(DATABASE_URL not set)", db: "(unknown)" };
  try {
    const url = new URL(raw);
    const db = decodeURIComponent(url.pathname.replace(/^\//, "")) || "(unknown)";
    return { host: maskHost(url.hostname), db };
  } catch {
    return { host: "(unparseable DATABASE_URL)", db: "(unknown)" };
  }
}

function printBanner(dryRun: boolean): void {
  const { host, db } = describeDatabase();
  const tmdbLabel = process.env.TMDB_API_KEY ? "enabled" : "disabled (TMDB_API_KEY not set)";
  const mode = dryRun ? "DRY RUN â€” searches TMDB, writes nothing" : "LIVE â€” assigns matched TMDB ids in the database below";

  console.log("â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€");
  console.log("  TMDB id resolution");
  console.log("â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€");
  console.log(`  Mode            : ${mode}`);
  console.log(`  Database host   : ${host}`);
  console.log(`  Database name   : ${db}`);
  console.log(`  TMDB access     : ${tmdbLabel}`);
  console.log("â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€");
}

function printSamples(samples: SampleRow[]): void {
  if (!samples.length) return;
  console.log(`\nProposed matches (first ${samples.length}, eyeball these for accuracy):`);
  for (const row of samples) console.log(`  ${row.from}\n      â†’ ${row.to}`);
}

function printSummary(summary: Summary, dryRun: boolean): void {
  console.log("\nâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€");
  console.log(dryRun ? "  Resolution preview (no writes)" : "  Resolution complete");
  console.log("â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€");
  console.log(`  Processed         : ${summary.processed}`);
  console.log(`  ${dryRun ? "Would resolve" : "Resolved     "}     : ${summary.resolved}`);
  console.log(`  No confident match: ${summary.noMatch}`);
  console.log(`  Conflicts skipped : ${summary.conflict} (id already used)`);
  console.log(`  Search failures   : ${summary.failed}`);
  console.log("â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€");
  if (dryRun) console.log("\nTo apply, re-run with confirmation:\n  npm run resolve:tmdb\n");
  else console.log("\nNext: enrich the newly-matched films:\n  npm run backfill:tmdb\n");
}

async function confirmLiveRun(preConfirmed: boolean): Promise<boolean> {
  if (preConfirmed) return true;
  if (!process.stdin.isTTY) {
    console.error("\nRefusing to run a LIVE resolution without confirmation.");
    console.error("This would write to the database shown above.\n");
    console.error("Preview first (no writes):   npm run resolve:tmdb:dry");
    console.error("Confirm and run for real:    npm run resolve:tmdb\n");
    return false;
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((resolve) => {
    rl.question("Type 'yes' to write matched TMDB ids to the database above: ", resolve);
  });
  rl.close();
  const confirmed = answer.trim().toLowerCase() === "yes";
  if (!confirmed) console.error("Confirmation not received â€” aborting without writing anything.");
  return confirmed;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run") || argv.includes("--dry");
  const yes = argv.includes("--yes") || argv.includes("-y");

  (async () => {
    printBanner(dryRun);

    if (!process.env.TMDB_API_KEY) {
      console.error("\nTMDB_API_KEY is not set â€” cannot search. Aborting.");
      process.exitCode = 1;
      return;
    }

    if (!dryRun && !(await confirmLiveRun(yes))) {
      process.exitCode = 1;
      return;
    }

    const { summary, samples } = await run({ dryRun });
    printSamples(samples);
    printSummary(summary, dryRun);
  })()
    .catch((error) => { console.error(error); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
