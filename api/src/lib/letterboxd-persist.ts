import { Prisma, type Movie } from "@prisma/client";
import { prisma } from "./prisma.js";
import { createDiaryDedupeKey, createFilmIdentity } from "./diary-dedupe.js";
import {
  buildCanonicalLetterboxdImport,
  LetterboxdImportValidationError,
  type LetterboxdFile,
  type LetterboxdFiles,
  type LetterboxdFilm,
} from "./letterboxd-import.js";

const MAX_IMPORT_FILMS = 15_000;
const MAX_IMPORT_EVENTS = 30_000;
const WRITE_BATCH_SIZE = 100;

export type ImportSummary = {
  films: number;
  events: number;
  moviesCreated: number;
  moviesUpdated: number;
  userMoviesCreated: number;
  userMoviesUpdated: number;
  logsCreated: number;
  logsUpdated: number;
  filesReceived: LetterboxdFile[];
};

function day(date: Date | null): string {
  return date?.toISOString().slice(0, 10) ?? "undated";
}

async function runWriteBatches(operations: Prisma.PrismaPromise<unknown>[]) {
  for (let index = 0; index < operations.length; index += WRITE_BATCH_SIZE) {
    await prisma.$transaction(operations.slice(index, index + WRITE_BATCH_SIZE));
  }
}

/** Resolve os filmes em lote e deixa o enriquecimento do TMDB para depois. */
async function resolveMovies(films: LetterboxdFilm[]): Promise<Map<string, Movie>> {
  const uris = films.map((film) => film.letterboxdUri).filter((uri): uri is string => Boolean(uri));
  const titles = films.map((film) => film.name);

  const loadCandidates = () => prisma.movie.findMany({
    where: {
      OR: [
        ...(uris.length ? [{ letterboxdUri: { in: uris } }] : []),
        { title: { in: titles } },
      ],
    },
  });

  const index = (movies: Movie[]) => {
    const byUri = new Map<string, Movie>();
    const byIdentity = new Map<string, Movie>();
    for (const movie of movies) {
      if (movie.letterboxdUri) byUri.set(movie.letterboxdUri, movie);
      byIdentity.set(createFilmIdentity(movie.title, movie.year), movie);
    }
    return { byUri, byIdentity };
  };

  const match = (film: LetterboxdFilm, byUri: Map<string, Movie>, byIdentity: Map<string, Movie>) =>
    (film.letterboxdUri ? byUri.get(film.letterboxdUri) : undefined) ?? byIdentity.get(film.key);

  let { byUri, byIdentity } = index(await loadCandidates());
  const resolved = new Map<string, Movie>();
  const toCreate: Array<{ title: string; year: number | null; letterboxdUri: string | null }> = [];

  for (const film of films) {
    const found = match(film, byUri, byIdentity);
    if (found) resolved.set(film.key, found);
    else toCreate.push({ title: film.name, year: film.year, letterboxdUri: film.letterboxdUri });
  }

  if (toCreate.length) {
    await prisma.movie.createMany({ data: toCreate, skipDuplicates: true });
    ({ byUri, byIdentity } = index(await loadCandidates()));
    for (const film of films) {
      if (resolved.has(film.key)) continue;
      const found = match(film, byUri, byIdentity);
      if (found) resolved.set(film.key, found);
    }
  }

  return resolved;
}

/** Salva a exportação no diário sem duplicar dados em uma nova importação. */
export async function importLetterboxdForUser(userId: string, files: LetterboxdFiles): Promise<ImportSummary> {
  const filesReceived = (Object.keys(files) as LetterboxdFile[]).filter((name) => (files[name] ?? "").trim().length > 0);
  const films = [...buildCanonicalLetterboxdImport(files).values()];
  const eventCount = films.reduce((total, film) => total + film.events.length, 0);

  if (!films.length) {
    throw new LetterboxdImportValidationError(
      "Os arquivos não contêm filmes reconhecíveis. Use o export original do Letterboxd.",
    );
  }
  if (films.length > MAX_IMPORT_FILMS || eventCount > MAX_IMPORT_EVENTS) {
    throw new LetterboxdImportValidationError(
      `O export é grande demais para a importação web (limite: ${MAX_IMPORT_FILMS.toLocaleString("pt-BR")} filmes e ${MAX_IMPORT_EVENTS.toLocaleString("pt-BR")} sessões).`,
    );
  }

  const summary: ImportSummary = {
    films: films.length,
    events: eventCount,
    moviesCreated: 0,
    moviesUpdated: 0,
    userMoviesCreated: 0,
    userMoviesUpdated: 0,
    logsCreated: 0,
    logsUpdated: 0,
    filesReceived,
  };

  const existingCatalogIds = new Set(
    (await prisma.movie.findMany({
      where: {
        OR: [
          { letterboxdUri: { in: films.map((f) => f.letterboxdUri).filter((u): u is string => Boolean(u)) } },
          { title: { in: films.map((f) => f.name) } },
        ],
      },
      select: { id: true },
    })).map((movie) => movie.id),
  );

  const movieByKey = await resolveMovies(films);
  const movieIds = [...movieByKey.values()].map((movie) => movie.id);
  for (const movie of movieByKey.values()) {
    if (existingCatalogIds.has(movie.id)) summary.moviesUpdated += 1;
    else summary.moviesCreated += 1;
  }

  // Estado da coleção do usuário
  const [existingUserMovies, occupiedFavoriteRanks] = await Promise.all([
    prisma.userMovie.findMany({ where: { userId, movieId: { in: movieIds } } }),
    prisma.userMovie.findMany({
      where: { userId, favoriteRank: { not: null } },
      select: { favoriteRank: true },
    }),
  ]);
  const userMovieByMovie = new Map(existingUserMovies.map((um) => [um.movieId, um]));
  const takenRanks = new Set(
    occupiedFavoriteRanks.map((um) => um.favoriteRank).filter((rank): rank is number => rank != null),
  );
  const userMovieCreates: Array<{
    userId: string; movieId: string; watched: boolean; favorite: boolean; watchlist: boolean;
    watchlistAddedAt: Date | null; rating: number | null; favoriteRank: number | null;
  }> = [];
  const userMovieUpdates: Prisma.PrismaPromise<unknown>[] = [];

  for (const film of films) {
    const movie = movieByKey.get(film.key);
    if (!movie) continue;
    const existing = userMovieByMovie.get(movie.id);

    let favoriteRank = existing?.favoriteRank ?? null;
    if (favoriteRank == null && film.profileRank != null && !takenRanks.has(film.profileRank)) {
      favoriteRank = film.profileRank;
      takenRanks.add(favoriteRank);
    }

    const data = {
      watched: film.watched || existing?.watched || false,
      favorite: film.favorite || existing?.favorite || false,
      watchlist: film.watchlist || existing?.watchlist || false,
      watchlistAddedAt: film.watchlist
        ? existing?.watchlistAddedAt ?? film.watchlistAddedAt ?? new Date()
        : existing?.watchlistAddedAt ?? null,
      rating: film.rating ?? existing?.rating ?? null,
      favoriteRank,
    };

    if (existing) {
      userMovieUpdates.push(prisma.userMovie.update({ where: { userId_movieId: { userId, movieId: movie.id } }, data }));
    } else {
      userMovieCreates.push({ userId, movieId: movie.id, ...data });
    }
  }
  await runWriteBatches(userMovieUpdates);
  summary.userMoviesUpdated = userMovieUpdates.length;
  if (userMovieCreates.length) {
    const result = await prisma.userMovie.createMany({ data: userMovieCreates, skipDuplicates: true });
    summary.userMoviesCreated = result.count;
  }

  // Sessões registradas pelo usuário
  const existingLogs = await prisma.logEntry.findMany({ where: { userId, movieId: { in: movieIds } } });
  const logsByMovie = new Map<string, typeof existingLogs>();
  for (const log of existingLogs) logsByMovie.set(log.movieId, [...(logsByMovie.get(log.movieId) ?? []), log]);

  const logCreates: Array<{
    userId: string; movieId: string; sourceKey: string; dedupeKey: string; sourceType: string;
    sourceUri: string | null; loggedAt: Date | null; watchedAt: Date | null; rating: number | null;
    review: string | null; rewatch: boolean; tags: string | null;
  }> = [];
  const logUpdates: Prisma.PrismaPromise<unknown>[] = [];

  for (const film of films) {
    const movie = movieByKey.get(film.key);
    if (!movie) continue;
    const existing = logsByMovie.get(movie.id) ?? [];
    const claimed = new Set<string>();
    const dayOccurrences = new Map<string, number>();

    for (const event of film.events) {
      const eventDay = day(event.watchedAt ?? event.loggedAt);
      const occurrence = (dayOccurrences.get(eventDay) ?? 0) + 1;
      dayOccurrences.set(eventDay, occurrence);

      // Inclui o usuário nas chaves para evitar colisões entre contas.
      const sourceKey = `${userId}:${event.importKey}`;
      const dedupeKey = createDiaryDedupeKey({
        movieId: `${userId}:${movie.id}`,
        watchedAt: event.watchedAt,
        loggedAt: event.loggedAt,
        occurrence,
      });

      const matched =
        existing.find((entry) => !claimed.has(entry.id) && entry.sourceKey === sourceKey)
        ?? existing.find((entry) => !claimed.has(entry.id) && entry.dedupeKey === dedupeKey);

      const shared = {
        sourceType: event.sourceTypes.join(",") || "letterboxd",
        sourceUri: event.sourceUri,
        loggedAt: event.loggedAt,
        watchedAt: event.watchedAt ?? event.loggedAt,
        rating: event.rating,
        review: event.review,
        rewatch: event.rewatch,
        tags: event.tags,
      };

      if (matched) {
        claimed.add(matched.id);
        logUpdates.push(prisma.logEntry.update({ where: { id: matched.id }, data: shared }));
      } else {
        logCreates.push({ userId, movieId: movie.id, sourceKey, dedupeKey, ...shared });
      }
    }
  }
  await runWriteBatches(logUpdates);
  summary.logsUpdated = logUpdates.length;
  if (logCreates.length) {
    const result = await prisma.logEntry.createMany({ data: logCreates, skipDuplicates: true });
    summary.logsCreated = result.count;
  }

  return summary;
}
