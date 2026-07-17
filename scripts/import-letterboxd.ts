import { readFile } from "node:fs/promises";
import path from "node:path";
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
import { getOwnerUser } from "../src/lib/auth";

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

  const owner = await getOwnerUser();
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

    const owner = await getOwnerUser();
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runImport({ skipMetadata: process.argv.includes("--skip-metadata") })
    .catch((error) => { console.error(error); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
