import { readFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import type { LogEntry, Movie } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createDiaryDedupeKey, normalizeTitle } from "@/lib/diary-dedupe";
import {
  buildCanonicalLetterboxdImport,
  type LetterboxdFiles,
  type LetterboxdFilm,
} from "@/lib/letterboxd-import";
import { getTmdbMovie, searchTmdbMovie } from "@/lib/tmdb";
import { ensureOwnerUser } from "../src/lib/auth";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(rootDirectory, ".env.local") });
config({ path: path.join(rootDirectory, ".env") });

const exportFileNames = [
  "diary.csv",
  "reviews.csv",
  "ratings.csv",
  "watched.csv",
  "watchlist.csv",
  "profile.csv",
  "likes/films.csv",
] as const;

function unionValues(...values: Array<string | null | undefined>): string {
  return [...new Set(values.flatMap((value) => (value ?? "").split(",").map((item) => item.trim()).filter(Boolean)))].join(", ");
}

export async function readLetterboxdExport(): Promise<LetterboxdFiles> {
  const files: LetterboxdFiles = {};
  await Promise.all(exportFileNames.map(async (fileName) => {
    try {
      files[fileName] = await readFile(path.join(rootDirectory, fileName), "utf8");
    } catch {
      files[fileName] = "";
    }
  }));
  return files;
}

async function findMovie(film: LetterboxdFilm): Promise<Movie | null> {
  if (film.letterboxdUri) {
    const byUri = await prisma.movie.findUnique({ where: { letterboxdUri: film.letterboxdUri } });
    if (byUri) return byUri;
  }
  return prisma.movie.findFirst({ where: { title: film.name, year: film.year } });
}

async function saveMovie(film: LetterboxdFilm, skipMetadata: boolean): Promise<Movie> {
  const existing = await findMovie(film);
  let metadata = {
    tmdbId: existing?.tmdbId ?? null,
    posterPath: existing?.posterPath ?? null,
    backdropPath: existing?.backdropPath ?? null,
    overview: existing?.overview ?? null,
    tagline: existing?.tagline ?? null,
    runtime: existing?.runtime ?? null,
    genres: existing?.genres ?? null,
    imdbId: existing?.imdbId ?? null,
    releaseDate: existing?.releaseDate ?? null,
    tmdbRating: existing?.tmdbRating ?? null,
    tmdbVoteCount: existing?.tmdbVoteCount ?? null,
    directors: existing?.directors ?? null,
    cast: existing?.cast ?? null,
  };

  if (!skipMetadata && process.env.TMDB_API_KEY && (!existing?.tmdbId || !existing.imdbId || !existing.releaseDate || !existing.directors)) {
    try {
      let details = existing?.tmdbId ? await getTmdbMovie(existing.tmdbId) : null;
      const detailsYear = details?.release_date ? Number(details.release_date.slice(0, 4)) : null;
      const identityMismatch = Boolean(details && film.year && detailsYear && detailsYear !== film.year);
      if (!details || identityMismatch) {
        const searchMatch = await searchTmdbMovie(film.name, film.year);
        details = searchMatch ? await getTmdbMovie(searchMatch.id) : null;
      }
      const tmdbId = details?.id;
      if (details && tmdbId) {
        metadata = {
          tmdbId: details.id,
          posterPath: existing?.posterPath ?? details.poster_path ?? null,
          backdropPath: existing?.backdropPath ?? details.backdrop_path ?? null,
          overview: details.overview ?? existing?.overview ?? null,
          tagline: details.tagline ?? existing?.tagline ?? null,
          runtime: details.runtime ?? existing?.runtime ?? null,
          genres: details.genres?.map((genre) => genre.name).join(", ") ?? existing?.genres ?? null,
          imdbId: details.external_ids?.imdb_id ?? existing?.imdbId ?? null,
          releaseDate: details.release_date ? new Date(`${details.release_date}T12:00:00.000Z`) : existing?.releaseDate ?? null,
          tmdbRating: details.vote_average ?? existing?.tmdbRating ?? null,
          tmdbVoteCount: details.vote_count ?? existing?.tmdbVoteCount ?? null,
          directors: details.credits?.crew.filter((person) => person.job === "Director").map((person) => person.name).join(", ") || existing?.directors || null,
          cast: details.credits?.cast.slice().sort((left, right) => left.order - right.order).slice(0, 8).map((person) => person.name).join(", ") || existing?.cast || null,
        };
      }
    } catch (error) {
      console.warn(`TMDb enrichment skipped for ${film.name}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  const data = {
    title: film.name,
    year: film.year,
    letterboxdUri: film.letterboxdUri,
    ...metadata,
    watched: film.watched || existing?.watched || false,
    rating: film.rating ?? existing?.rating ?? null,
    favorite: film.favorite || existing?.favorite || false,
    watchlist: film.watchlist || existing?.watchlist || false,
    watchlistAddedAt: film.watchlist
      ? existing?.watchlistAddedAt ?? film.watchlistAddedAt ?? new Date()
      : existing?.watchlistAddedAt ?? null,
  };

  // Older imports could attach the first fuzzy TMDb result to the wrong film.
  // When an exact title/year search now resolves to an identifier occupied by a
  // different entity, release only that entity's derived metadata; its journal
  // and collection state stay intact and it is enriched correctly later.
  const conflicting = metadata.tmdbId
    ? await prisma.movie.findUnique({ where: { tmdbId: metadata.tmdbId } })
    : metadata.imdbId ? await prisma.movie.findUnique({ where: { imdbId: metadata.imdbId } }) : null;
  if (conflicting && conflicting.id !== existing?.id) {
    const sameIdentity = normalizeTitle(conflicting.title) === normalizeTitle(film.name) && (!conflicting.year || !film.year || Math.abs(conflicting.year - film.year) <= 1);
    if (!sameIdentity) {
      await prisma.movie.update({
        where: { id: conflicting.id },
        data: { tmdbId: null, imdbId: null, releaseDate: null, posterPath: null, backdropPath: null, overview: null, tagline: null, runtime: null, genres: null, directors: null, cast: null, tmdbRating: null, tmdbVoteCount: null },
      });
    }
  }

  let movie: Movie;
  if (existing) {
    movie = await prisma.movie.update({ where: { id: existing.id }, data });
  } else if (metadata.tmdbId) {
    const byTmdb = await prisma.movie.findUnique({ where: { tmdbId: metadata.tmdbId } });
    movie = byTmdb
      ? await prisma.movie.update({ where: { id: byTmdb.id }, data })
      : await prisma.movie.create({ data });
  } else {
    movie = await prisma.movie.create({ data });
  }

  const owner = await ensureOwnerUser();
  const ownerId = owner?.id || "";
  if (ownerId) {
    await prisma.userMovie.upsert({
      where: { userId_movieId: { userId: ownerId, movieId: movie.id } },
      create: {
        userId: ownerId,
        movieId: movie.id,
        watched: film.watched || false,
        favorite: film.favorite || false,
        watchlist: film.watchlist || false,
        watchlistAddedAt: film.watchlist ? (film.watchlistAddedAt ?? new Date()) : null,
        rating: film.rating ?? null,
      },
      update: {
        watched: film.watched || false,
        favorite: film.favorite || false,
        watchlist: film.watchlist || false,
        watchlistAddedAt: film.watchlist ? (film.watchlistAddedAt ?? new Date()) : null,
        rating: film.rating ?? null,
      }
    });
  }

  if (film.profileRank && movie.favoriteRank == null) {
    const occupant = await prisma.movie.findUnique({ where: { favoriteRank: film.profileRank } });
    if (!occupant) movie = await prisma.movie.update({ where: { id: movie.id }, data: { favoriteRank: film.profileRank } });
  }
  return movie;
}

function sameDay(entry: LogEntry, watchedAt: Date | null, loggedAt: Date | null): boolean {
  const left = entry.watchedAt ?? entry.loggedAt;
  const right = watchedAt ?? loggedAt;
  return Boolean(left && right && left.toISOString().slice(0, 10) === right.toISOString().slice(0, 10));
}

async function saveEvents(movie: Movie, film: LetterboxdFilm): Promise<number> {
  const existingLogs = await prisma.logEntry.findMany({ where: { movieId: movie.id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  // Reassign event ordinals from a clean slate. This prevents a unique-key
  // collision when two legitimate same-day URI events change sort order.
  if (existingLogs.length) await prisma.logEntry.updateMany({ where: { movieId: movie.id }, data: { dedupeKey: null } });
  const claimed = new Set<string>();
  const dayOccurrences = new Map<string, number>();

  for (const event of film.events) {
    const eventDate = event.watchedAt ?? event.loggedAt;
    const eventDay = eventDate?.toISOString().slice(0, 10) ?? "undated";
    const occurrence = (dayOccurrences.get(eventDay) ?? 0) + 1;
    dayOccurrences.set(eventDay, occurrence);
    const dedupeKey = createDiaryDedupeKey({ movieId: movie.id, watchedAt: event.watchedAt, loggedAt: event.loggedAt, occurrence });
    const sameDayCandidates = existingLogs.filter((entry) => !claimed.has(entry.id) && sameDay(entry, event.watchedAt, event.loggedAt));
    const uriMatches = event.sourceUri ? await prisma.logEntry.findMany({ where: { sourceUri: event.sourceUri }, orderBy: { createdAt: "asc" } }) : [];
    let existing = existingLogs.find((entry) => !claimed.has(entry.id) && entry.sourceKey === event.importKey)
      ?? existingLogs.find((entry) => !claimed.has(entry.id) && event.sourceUri && entry.sourceUri === event.sourceUri)
      ?? existingLogs.find((entry) => !claimed.has(entry.id) && entry.dedupeKey === dedupeKey)
      ?? uriMatches[0]
      ?? (sameDayCandidates.length === 1 && film.events.filter((candidate) => {
        const date = candidate.watchedAt ?? candidate.loggedAt;
        return date?.toISOString().slice(0, 10) === eventDay;
      }).length === 1 ? sameDayCandidates[0] : undefined);

    const owner = await ensureOwnerUser();
    const ownerId = owner?.id || "";

    const data = {
      userId: ownerId,
      movieId: movie.id,
      sourceKey: event.importKey,
      dedupeKey,
      sourceType: unionValues(existing?.sourceType, event.sourceTypes.join(",")) || "letterboxd",
      sourceUri: event.sourceUri ?? existing?.sourceUri ?? null,
      loggedAt: event.loggedAt ?? existing?.loggedAt ?? null,
      watchedAt: event.watchedAt ?? existing?.watchedAt ?? event.loggedAt ?? null,
      rating: event.rating ?? existing?.rating ?? uriMatches.find((entry) => entry.rating != null)?.rating ?? null,
      review: event.review?.trim() ? event.review : existing?.review ?? uriMatches.find((entry) => entry.review?.trim())?.review ?? null,
      rewatch: event.rewatch || existing?.rewatch || false,
      tags: unionValues(existing?.tags, ...uriMatches.map((entry) => entry.tags), event.tags) || null,
      favorite: existing?.favorite || uriMatches.some((entry) => entry.favorite),
    };

    if (existing) {
      const redundantIds = uriMatches.filter((entry) => entry.id !== existing?.id).map((entry) => entry.id);
      if (redundantIds.length) await prisma.logEntry.deleteMany({ where: { id: { in: redundantIds } } });
      existing = await prisma.logEntry.update({ where: { id: existing.id }, data });
      if (!existingLogs.some((entry) => entry.id === existing?.id)) existingLogs.push(existing);
    } else {
      existing = await prisma.logEntry.create({ data });
      existingLogs.push(existing);
    }
    claimed.add(existing.id);
  }
  return film.events.length;
}

export async function runImport(options: { skipMetadata?: boolean } = {}): Promise<{ films: number; events: number }> {
  const canonical = buildCanonicalLetterboxdImport(await readLetterboxdExport());
  let events = 0;
  for (const film of canonical.values()) {
    try {
      const movie = await saveMovie(film, options.skipMetadata === true);
      events += await saveEvents(movie, film);
    } catch (error) {
      console.error(`Import failed while reconciling ${film.name} (${film.year ?? "year unknown"}).`);
      throw error;
    }
  }
  console.log(`Imported ${events} canonical watch events across ${canonical.size} films. Catalog rows updated movie state only.`);
  return { films: canonical.size, events };
}

type ImportPlan = {
  filesPresent: string[];
  filesMissing: string[];
  films: number;
  totalEvents: number;
  moviesToCreate: number;
  moviesToUpdate: number;
  userMoviesToCreate: number;
  userMoviesToUpdate: number;
  logsToCreate: number;
  logsToUpdate: number;
  ownerResolved: boolean;
  skipped: { unknownTitle: number; missingYear: number; undatedEvents: number };
};

/**
 * Read-only preview of a live import. Performs ZERO database writes: it never
 * calls `ensureOwnerUser` (which would create/promote the owner) and only reads
 * existing rows to estimate create-vs-update counts, mirroring the match
 * priority used by `saveEvents` (sourceKey -> sourceUri -> same-day).
 */
export async function planImport(): Promise<ImportPlan> {
  const files = await readLetterboxdExport();
  const filesPresent = exportFileNames.filter((name) => (files[name] ?? "").trim().length > 0);
  const filesMissing = exportFileNames.filter((name) => !(files[name] ?? "").trim());
  const canonical = buildCanonicalLetterboxdImport(files);

  const ownerUsername = process.env.APP_OWNER_USERNAME?.trim() || null;
  const owner = ownerUsername ? await prisma.user.findUnique({ where: { username: ownerUsername } }) : null;
  const ownerId = owner?.id ?? "";

  const plan: ImportPlan = {
    filesPresent,
    filesMissing,
    films: canonical.size,
    totalEvents: 0,
    moviesToCreate: 0,
    moviesToUpdate: 0,
    userMoviesToCreate: 0,
    userMoviesToUpdate: 0,
    logsToCreate: 0,
    logsToUpdate: 0,
    ownerResolved: Boolean(owner),
    skipped: { unknownTitle: 0, missingYear: 0, undatedEvents: 0 },
  };

  for (const film of canonical.values()) {
    if (film.name === "Unknown title") plan.skipped.unknownTitle += 1;
    if (film.year == null) plan.skipped.missingYear += 1;

    const movie = await findMovie(film);
    if (movie) plan.moviesToUpdate += 1;
    else plan.moviesToCreate += 1;

    if (ownerId) {
      const existingUserMovie = movie
        ? await prisma.userMovie.findUnique({ where: { userId_movieId: { userId: ownerId, movieId: movie.id } } })
        : null;
      if (existingUserMovie) plan.userMoviesToUpdate += 1;
      else plan.userMoviesToCreate += 1;
    } else {
      // No owner yet: a live run would create it, then create one UserMovie per film.
      plan.userMoviesToCreate += 1;
    }

    const existingLogs = movie ? await prisma.logEntry.findMany({ where: { movieId: movie.id } }) : [];
    const claimed = new Set<string>();
    for (const event of film.events) {
      plan.totalEvents += 1;
      if (!event.watchedAt && !event.loggedAt) plan.skipped.undatedEvents += 1;
      const match =
        existingLogs.find((entry) => !claimed.has(entry.id) && entry.sourceKey === event.importKey)
        ?? existingLogs.find((entry) => !claimed.has(entry.id) && event.sourceUri != null && entry.sourceUri === event.sourceUri)
        ?? existingLogs.find((entry) => !claimed.has(entry.id) && sameDay(entry, event.watchedAt, event.loggedAt));
      if (match) {
        claimed.add(match.id);
        plan.logsToUpdate += 1;
      } else {
        plan.logsToCreate += 1;
      }
    }
  }

  return plan;
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

function printBanner(options: { dryRun: boolean; skipMetadata: boolean }): void {
  const { host, db } = describeDatabase();
  const owner = process.env.APP_OWNER_USERNAME?.trim() || "(APP_OWNER_USERNAME not set)";
  const tmdbEnabled = !options.skipMetadata && Boolean(process.env.TMDB_API_KEY);
  const tmdbLabel = tmdbEnabled
    ? "enabled"
    : options.skipMetadata
      ? "disabled (--skip-metadata)"
      : "disabled (TMDB_API_KEY not set)";
  const mode = options.dryRun ? "DRY RUN — no database writes" : "LIVE IMPORT — writes to the database below";

  console.log("──────────────────────────────────────────────");
  console.log("  Letterboxd import");
  console.log("──────────────────────────────────────────────");
  console.log(`  Mode            : ${mode}`);
  console.log(`  Database host   : ${host}`);
  console.log(`  Database name   : ${db}`);
  console.log(`  Owner user      : ${owner}`);
  console.log(`  TMDB enrichment : ${tmdbLabel}`);
  console.log("──────────────────────────────────────────────");
}

function printPlan(plan: ImportPlan): void {
  console.log("\nDRY RUN — no database writes were performed.\n");
  console.log(`Files present (${plan.filesPresent.length}): ${plan.filesPresent.join(", ") || "none"}`);
  console.log(`Files missing (${plan.filesMissing.length}): ${plan.filesMissing.join(", ") || "none"}`);
  console.log(`\nParsed ${plan.films} films / ${plan.totalEvents} watch events.`);
  if (!plan.ownerResolved) {
    console.log("⚠ APP_OWNER_USERNAME does not exist in this database yet. A live run would create/promote it before writing owner-scoped rows.");
  }
  console.log("\nWould write:");
  console.log(`  Movies      : ${plan.moviesToCreate} create, ${plan.moviesToUpdate} update`);
  console.log(`  UserMovies  : ${plan.userMoviesToCreate} create, ${plan.userMoviesToUpdate} update${plan.ownerResolved ? "" : " (estimated — owner will be created first)"}`);
  console.log(`  Log entries : ${plan.logsToCreate} create, ${plan.logsToUpdate} update`);

  const { unknownTitle, missingYear, undatedEvents } = plan.skipped;
  if (unknownTitle || missingYear || undatedEvents) {
    console.log("\nParse notes:");
    if (unknownTitle) console.log(`  ${unknownTitle} film(s) had no title (fell back to "Unknown title")`);
    if (missingYear) console.log(`  ${missingYear} film(s) had no parseable year`);
    if (undatedEvents) console.log(`  ${undatedEvents} watch event(s) had no date`);
  }
  console.log("\nCreate/update counts reflect the current database state and are an estimate.");
  console.log("To apply these changes, re-run with confirmation:\n  npm run import:letterboxd -- --yes\n");
}

async function confirmLiveImport(preConfirmed: boolean): Promise<boolean> {
  if (preConfirmed) return true;

  if (!process.stdin.isTTY) {
    console.error("\nRefusing to run a LIVE import without confirmation.");
    console.error("This would write to the database shown above.\n");
    console.error("Preview first (no writes):   npm run import:letterboxd:dry");
    console.error("Confirm and run for real:    npm run import:letterboxd -- --yes\n");
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
  const options = {
    dryRun: argv.includes("--dry-run") || argv.includes("--dry"),
    skipMetadata: argv.includes("--skip-metadata"),
    yes: argv.includes("--yes") || argv.includes("-y"),
  };

  (async () => {
    printBanner(options);

    if (options.dryRun) {
      printPlan(await planImport());
      return;
    }

    if (!(await confirmLiveImport(options.yes))) {
      process.exitCode = 1;
      return;
    }

    await runImport({ skipMetadata: options.skipMetadata });
  })()
    .catch((error) => { console.error(error); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
