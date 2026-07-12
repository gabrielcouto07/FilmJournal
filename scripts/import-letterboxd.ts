import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { prisma } from "@/lib/prisma";
import { createDiaryDedupeKey } from "@/lib/diary-dedupe";
import { getTmdbMovie, searchTmdbMovie } from "@/lib/tmdb";

type CsvRow = Record<string, string>;

type ImportRecord = {
  name: string;
  year: number | null;
  uri: string | null;
  loggedAt: Date | null;
  watchedAt: Date | null;
  rating: number | null;
  review: string | null;
  rewatch: boolean;
  tags: string | null;
  sourceTypes: Set<string>;
  favorite: boolean;
};

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(rootDirectory, ".env.local") });
config({ path: path.join(rootDirectory, ".env") });

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"' && quoted && nextCharacter === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }
      row.push(field);
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const headers = (rows.shift() ?? []).map((header) => header.replace(/^\uFEFF/, "").trim());
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

async function readCsv(relativePath: string): Promise<CsvRow[]> {
  try {
    return parseCsv(await readFile(path.join(rootDirectory, relativePath), "utf8"));
  } catch {
    return [];
  }
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(`${value.trim()}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseYear(value: string | undefined): number | null {
  const year = Number(value);
  return Number.isInteger(year) && year > 1800 ? year : null;
}

function parseRating(value: string | undefined): number | null {
  if (!value) return null;
  const rating = Number(value);
  return rating >= 0.5 && rating <= 5 ? rating : null;
}

function parseBoolean(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "yes" || value?.trim().toLowerCase() === "true";
}

function rowToRecord(row: CsvRow, sourceType: string): ImportRecord {
  return {
    name: row.Name?.trim() ?? "Unknown title",
    year: parseYear(row.Year),
    uri: row["Letterboxd URI"]?.trim() || null,
    loggedAt: parseDate(row.Date),
    watchedAt: parseDate(row["Watched Date"]),
    rating: parseRating(row.Rating),
    review: row.Review?.trim() || null,
    rewatch: parseBoolean(row.Rewatch),
    tags: row.Tags?.trim() || null,
    sourceTypes: new Set([sourceType]),
    favorite: false,
  };
}

function mergeRecords(records: ImportRecord[], incoming: ImportRecord): void {
  const matchingUriRecords = records.filter((record) => incoming.uri && record.uri === incoming.uri);
  const incomingWatchDate = incoming.watchedAt ?? incoming.loggedAt;
  const match = matchingUriRecords.find((record) => {
    const recordWatchDate = record.watchedAt ?? record.loggedAt;
    return incomingWatchDate && recordWatchDate && incomingWatchDate.getTime() === recordWatchDate.getTime();
  })
    // A rating-only export has no watch date. Only merge it when the URI has one
    // unambiguous existing watch; otherwise preserve potential rewatches.
    ?? (!incoming.watchedAt && matchingUriRecords.length === 1 ? matchingUriRecords[0] : undefined);

  if (!match) {
    records.push(incoming);
    return;
  }

  match.loggedAt ??= incoming.loggedAt;
  match.watchedAt ??= incoming.watchedAt;
  match.rating ??= incoming.rating;
  match.review ??= incoming.review;
  match.tags ??= incoming.tags;
  match.rewatch ||= incoming.rewatch;
  incoming.sourceTypes.forEach((sourceType) => match.sourceTypes.add(sourceType));
}

function mergeCommaValues(...values: Array<string | null | undefined>): string | null {
  const merged = [...new Set(values.flatMap((value) => (value ?? "").split(",").map((item) => item.trim()).filter(Boolean)))];
  return merged.length ? merged.join(", ") : null;
}

async function findOrCreateMovie(record: ImportRecord, watchlist: boolean): Promise<{ id: string }> {
  const existing = record.uri
    ? await prisma.movie.findUnique({ where: { letterboxdUri: record.uri } })
    : await prisma.movie.findFirst({ where: { title: record.name, year: record.year } });

  let tmdbId = existing?.tmdbId ?? null;
  let posterPath = existing?.posterPath ?? null;
  let backdropPath = existing?.backdropPath ?? null;
  let overview = existing?.overview ?? null;
  let tagline = existing?.tagline ?? null;
  let runtime = existing?.runtime ?? null;
  let genres = existing?.genres ?? null;
  let imdbId = existing?.imdbId ?? null;

  if (process.env.TMDB_API_KEY && (!existing || !existing.imdbId)) {
    try {
      const match = existing?.tmdbId ? null : await searchTmdbMovie(record.name, record.year);
      const tmdbMovieId = existing?.tmdbId ?? match?.id;
      if (tmdbMovieId) {
        const details = await getTmdbMovie(tmdbMovieId);
        tmdbId = details.id;
        posterPath = details.poster_path ?? null;
        backdropPath = details.backdrop_path ?? null;
        overview = details.overview ?? null;
        tagline = details.tagline ?? null;
        runtime = details.runtime ?? null;
        genres = details.genres?.map((genre) => genre.name).join(", ") ?? null;
        imdbId = details.external_ids?.imdb_id ?? null;
      }
    } catch (error) {
      console.warn(`TMDb enrichment skipped for ${record.name}: ${(error as Error).message}`);
    }
  }

  const data = {
    title: record.name,
    year: record.year,
    letterboxdUri: record.uri,
    tmdbId,
    posterPath,
    backdropPath,
    overview,
    tagline,
    runtime,
    genres,
    imdbId,
    watchlist,
    watchlistAddedAt: watchlist ? existing?.watchlistAddedAt ?? new Date() : existing?.watchlistAddedAt ?? null,
  };

  if (existing) {
    return prisma.movie.update({ where: { id: existing.id }, data });
  }

  if (tmdbId) {
    const tmdbMovie = await prisma.movie.findUnique({ where: { tmdbId } });
    if (tmdbMovie) {
      return prisma.movie.update({ where: { id: tmdbMovie.id }, data });
    }
  }

  return prisma.movie.create({ data });
}

async function importFile(records: ImportRecord[], fileName: string, sourceType: string): Promise<void> {
  const rows = await readCsv(fileName);
  rows.forEach((row) => mergeRecords(records, rowToRecord(row, sourceType)));
}

async function importWatchlist(): Promise<ImportRecord[]> {
  const records: ImportRecord[] = [];
  const rows = await readCsv("watchlist.csv");
  rows.forEach((row) => mergeRecords(records, rowToRecord(row, "watchlist")));
  return records;
}

async function getFavoriteUris(): Promise<Set<string>> {
  const profileRows = await readCsv("profile.csv");
  const favoriteFilms = profileRows[0]?.["Favorite Films"] ?? "";
  return new Set(favoriteFilms.split(",").map((uri) => uri.trim()).filter(Boolean));
}

export async function runImport(): Promise<void> {
  const records: ImportRecord[] = [];
  await importFile(records, "diary.csv", "diary");
  await importFile(records, "reviews.csv", "review");
  await importFile(records, "ratings.csv", "rating");
  await importFile(records, "watched.csv", "watched");

  const favoriteUris = await getFavoriteUris();
  records.forEach((record) => {
    record.favorite = Boolean(record.uri && favoriteUris.has(record.uri));
  });

  const watchlistRecords = await importWatchlist();
  const movieCache = new Map<string, { id: string }>();
  const getMovie = async (record: ImportRecord, watchlist: boolean) => {
    const key = record.uri ?? `${record.name}:${record.year ?? ""}`;
    const cached = movieCache.get(key);
    if (cached) {
      if (watchlist) {
        await prisma.movie.update({ where: { id: cached.id }, data: { watchlist: true } });
        await prisma.movie.updateMany({ where: { id: cached.id, watchlistAddedAt: null }, data: { watchlistAddedAt: new Date() } });
      }
      return cached;
    }
    const movie = await findOrCreateMovie(record, watchlist);
    movieCache.set(key, movie);
    return movie;
  };

  const importInBatches = async (items: ImportRecord[], watchlist: boolean) => {
    const movies = new Map<string, { id: string }>();
    for (let index = 0; index < items.length; index += 8) {
      const batch = items.slice(index, index + 8);
      const results = await Promise.all(batch.map(async (record) => [
        record.uri ?? `${record.name}:${record.year ?? ""}`,
        await getMovie(record, watchlist),
      ] as const));
      results.forEach(([key, movie]) => movies.set(key, movie));
    }
    return movies;
  };

  const importedMovies = await importInBatches(records, false);

  for (const record of records) {
    const movie = importedMovies.get(record.uri ?? `${record.name}:${record.year ?? ""}`)!;
    const watchedAt = record.watchedAt ?? record.loggedAt;
    const sourceKey = `${record.uri ?? record.name}|${watchedAt?.toISOString() ?? "undated"}`;
    const dedupeKey = createDiaryDedupeKey({
      movieId: movie.id,
      watchedAt,
      loggedAt: record.loggedAt,
      rating: record.rating,
      review: record.review,
    });
    const existing = (dedupeKey ? await prisma.logEntry.findUnique({ where: { dedupeKey } }) : null)
      ?? await prisma.logEntry.findUnique({ where: { sourceKey } });
    const sourceType = mergeCommaValues(existing?.sourceType, [...record.sourceTypes].join(",")) ?? "import";

    if (existing) {
      await prisma.logEntry.update({
        where: { id: existing.id },
        data: {
          movieId: movie.id,
          dedupeKey,
          sourceType,
          sourceUri: existing.sourceUri ?? record.uri,
          loggedAt: existing.loggedAt ?? record.loggedAt,
          watchedAt: existing.watchedAt ?? watchedAt,
          rating: existing.rating ?? record.rating,
          review: existing.review ?? record.review,
          favorite: existing.favorite || record.favorite,
          rewatch: existing.rewatch || record.rewatch,
          tags: mergeCommaValues(existing.tags, record.tags),
        },
      });
    } else {
      await prisma.logEntry.create({
        data: {
          movieId: movie.id,
          sourceKey,
          dedupeKey,
          sourceType,
          sourceUri: record.uri,
          loggedAt: record.loggedAt,
          watchedAt,
          rating: record.rating,
          review: record.review,
          favorite: record.favorite,
          rewatch: record.rewatch,
          tags: record.tags,
        },
      });
    }
  }

  await importInBatches(watchlistRecords, true);

  console.log(`Imported ${records.length} log entries and ${watchlistRecords.length} watchlist movies.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runImport()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
