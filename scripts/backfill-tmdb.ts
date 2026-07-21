import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { prisma } from "@/lib/prisma";
import { getTmdbMovie, TmdbError, type TmdbMovieDetails } from "@/lib/tmdb";
import { ensureTaxonomyRows, relationalEnrichmentData } from "@/lib/movie-metadata";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(rootDirectory, ".env.local") });
config({ path: path.join(rootDirectory, ".env") });

// TMDB's public limit is generous (~50 req/s), so a small concurrent batch with
// a short breather between batches keeps us comfortably under it.
const BATCH_SIZE = 6;
const BATCH_PAUSE_MS = 200;
const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// A film counts as enriched once originalLanguage is set. TMDB returns
// original_language for every valid movie, so a successful backfill always
// populates it — making it a reliable "skip me on re-run" sentinel.
const ENRICHED_WHERE = { tmdbId: { not: null }, originalLanguage: { not: null } } as const;
const PENDING_WHERE = { tmdbId: { not: null }, originalLanguage: null } as const;

type BackfillOptions = { dryRun: boolean; force: boolean; yes: boolean };

type Summary = { processed: number; updated: number; skipped: number; failed: number };

/** Retry TMDB reads on transient failures (rate limiting / upstream hiccups). */
async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      const status = error instanceof TmdbError ? error.status : 0;
      const retriable = status === 429 || status === 502 || status === 503;
      if (!retriable || attempt >= RETRY_DELAYS_MS.length) throw error;
      const wait = RETRY_DELAYS_MS[attempt];
      console.warn(`  ${label}: TMDB ${status} — retrying in ${wait}ms (attempt ${attempt + 1}/${RETRY_DELAYS_MS.length})`);
      await sleep(wait);
    }
  }
}

type MovieRef = { id: string; tmdbId: number; title: string };
type Fetched = { movie: MovieRef; details: TmdbMovieDetails } | { movie: MovieRef; error: unknown };

/** Fetch one film's TMDB details (with retry). Errors are captured, not thrown. */
async function fetchDetails(movie: MovieRef): Promise<Fetched> {
  try {
    const details = await withRetry(() => getTmdbMovie(movie.tmdbId), movie.title);
    return { movie, details };
  } catch (error) {
    return { movie, error };
  }
}

/**
 * Write one film's enriched fields. Genre/Keyword rows are created up front by
 * the caller (see runBackfill), so we only `set` relations here — avoiding the
 * connectOrCreate race where concurrent siblings insert the same taxonomy id.
 * The field shape is shared with the on-demand enrichment path
 * (src/lib/movie-metadata.ts) so the two cannot drift.
 */
async function writeMovie(movie: MovieRef, details: TmdbMovieDetails): Promise<void> {
  await prisma.movie.update({ where: { id: movie.id }, data: relationalEnrichmentData(details) });
}

async function runBackfill(options: BackfillOptions): Promise<Summary> {
  const where = options.force ? { tmdbId: { not: null } } : PENDING_WHERE;
  const movies = await prisma.movie.findMany({
    where,
    select: { id: true, tmdbId: true, title: true },
    orderBy: { createdAt: "asc" },
  });

  const summary: Summary = { processed: 0, updated: 0, skipped: 0, failed: 0 };

  for (let index = 0; index < movies.length; index += BATCH_SIZE) {
    const batch: MovieRef[] = movies.slice(index, index + BATCH_SIZE).map((movie) => ({
      id: movie.id,
      tmdbId: movie.tmdbId!,
      title: movie.title,
    }));

    // 1. Fetch all details in the batch concurrently (network-bound).
    const fetched = await Promise.all(batch.map(fetchDetails));

    // 2. Create every genre/keyword the batch references in one atomic,
    //    conflict-safe write, so the per-movie updates below never race to
    //    insert the same taxonomy id.
    await ensureTaxonomyRows(fetched.flatMap((item) => ("details" in item ? [item.details] : [])));

    // 3. Write each film. A distinct movieId per row means concurrent relation
    //    `set`s cannot collide.
    await Promise.all(fetched.map(async (item) => {
      summary.processed += 1;
      if (!("details" in item)) {
        summary.failed += 1;
        console.warn(`  Fetch failed for ${item.movie.title}: ${item.error instanceof Error ? item.error.message : "unknown error"}`);
        return;
      }
      try {
        await writeMovie(item.movie, item.details);
        summary.updated += 1;
      } catch (error) {
        summary.failed += 1;
        console.warn(`  Write failed for ${item.movie.title}: ${error instanceof Error ? error.message : "unknown error"}`);
      }
    }));

    console.log(`Progress: ${Math.min(index + batch.length, movies.length)}/${movies.length}`);
    if (index + BATCH_SIZE < movies.length) await sleep(BATCH_PAUSE_MS);
  }

  return summary;
}

type BackfillPlan = {
  totalMovies: number;
  withTmdbId: number;
  withoutTmdbId: number;
  alreadyEnriched: number;
  wouldProcess: number;
};

async function planBackfill(force: boolean): Promise<BackfillPlan> {
  const [totalMovies, withTmdbId, alreadyEnriched] = await Promise.all([
    prisma.movie.count(),
    prisma.movie.count({ where: { tmdbId: { not: null } } }),
    prisma.movie.count({ where: ENRICHED_WHERE }),
  ]);
  return {
    totalMovies,
    withTmdbId,
    withoutTmdbId: totalMovies - withTmdbId,
    alreadyEnriched,
    wouldProcess: force ? withTmdbId : withTmdbId - alreadyEnriched,
  };
}

function maskHost(host: string): string {
  const [first, ...rest] = host.split(".");
  const maskedFirst = !first || first.length <= 4 ? first : `${first.slice(0, 2)}…${first.slice(-2)}`;
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

function printBanner(options: BackfillOptions): void {
  const { host, db } = describeDatabase();
  const tmdbLabel = process.env.TMDB_API_KEY ? "enabled" : "disabled (TMDB_API_KEY not set)";
  const mode = options.dryRun ? "DRY RUN — no database writes" : "LIVE BACKFILL — writes to the database below";

  console.log("──────────────────────────────────────────────");
  console.log("  TMDB taste-analytics backfill");
  console.log("──────────────────────────────────────────────");
  console.log(`  Mode            : ${mode}`);
  console.log(`  Database host   : ${host}`);
  console.log(`  Database name   : ${db}`);
  console.log(`  TMDB access     : ${tmdbLabel}`);
  console.log(`  Re-enrich all   : ${options.force ? "yes (--force)" : "no (skip enriched)"}`);
  console.log("──────────────────────────────────────────────");
}

function printPlan(plan: BackfillPlan, force: boolean): void {
  console.log("\nDRY RUN — no database writes were performed.\n");
  console.log(`Movies in catalog    : ${plan.totalMovies}`);
  console.log(`  with a TMDB id     : ${plan.withTmdbId}`);
  console.log(`  without a TMDB id  : ${plan.withoutTmdbId} (cannot be enriched)`);
  console.log(`  already enriched   : ${plan.alreadyEnriched}${force ? " (would be re-processed: --force)" : " (would be skipped)"}`);
  console.log(`\nWould enrich         : ${plan.wouldProcess} film(s)`);
  console.log("\nTo apply, re-run with confirmation:\n  npm run backfill:tmdb\n");
}

function printSummary(summary: Summary): void {
  console.log("\n──────────────────────────────────────────────");
  console.log("  Backfill complete");
  console.log("──────────────────────────────────────────────");
  console.log(`  Processed : ${summary.processed}`);
  console.log(`  Updated   : ${summary.updated}`);
  console.log(`  Skipped   : ${summary.skipped} (already enriched)`);
  console.log(`  Failed    : ${summary.failed}`);
  console.log("──────────────────────────────────────────────");
}

async function confirmLiveRun(preConfirmed: boolean): Promise<boolean> {
  if (preConfirmed) return true;

  if (!process.stdin.isTTY) {
    console.error("\nRefusing to run a LIVE backfill without confirmation.");
    console.error("This would write to the database shown above.\n");
    console.error("Preview first (no writes):   npm run backfill:tmdb:dry");
    console.error("Confirm and run for real:    npm run backfill:tmdb\n");
    return false;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((resolve) => {
    rl.question("Type 'yes' to write these changes to the database above: ", resolve);
  });
  rl.close();
  const confirmed = answer.trim().toLowerCase() === "yes";
  if (!confirmed) console.error("Confirmation not received — aborting without writing anything.");
  return confirmed;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const options: BackfillOptions = {
    dryRun: argv.includes("--dry-run") || argv.includes("--dry"),
    force: argv.includes("--force"),
    yes: argv.includes("--yes") || argv.includes("-y"),
  };

  (async () => {
    printBanner(options);

    if (options.dryRun) {
      printPlan(await planBackfill(options.force), options.force);
      return;
    }

    if (!process.env.TMDB_API_KEY) {
      console.error("\nTMDB_API_KEY is not set — cannot fetch metadata. Aborting.");
      process.exitCode = 1;
      return;
    }

    if (!(await confirmLiveRun(options.yes))) {
      process.exitCode = 1;
      return;
    }

    const plan = await planBackfill(options.force);
    const summary = await runBackfill(options);
    // Films not in scope this run were already enriched (unless --force).
    summary.skipped = options.force ? 0 : plan.alreadyEnriched;
    printSummary(summary);
  })()
    .catch((error) => { console.error(error); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
