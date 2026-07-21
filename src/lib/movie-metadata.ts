import { Prisma, type Movie } from "@prisma/client";
import { prisma } from "./prisma";
import { getTmdbMovie, searchTmdbMovie, toMovieMetadata, type TmdbMovieDetails } from "./tmdb";

function missingMetadata(movie: Movie) {
  // originalLanguage doubles as the relational-enrichment sentinel (the same
  // one scripts/backfill-tmdb.ts uses): TMDB returns original_language for
  // every valid movie, so a film that has it also had its genreList/keywords/
  // countries/director fields written. Films that are complete on every check
  // are a no-op for enrichMovieMetadata.
  return !movie.posterPath || !movie.tmdbId || !movie.genres || !movie.directors || !movie.originalLanguage;
}

function metadataWithoutIdentity(metadata: ReturnType<typeof toMovieMetadata>) {
  const { tmdbId, imdbId, ...shared } = metadata;
  void tmdbId;
  void imdbId;
  return shared;
}

/**
 * The relational taste-analytics fields derived from a TMDB details payload
 * (fetched via getTmdbMovie, which appends credits + keywords). Shared by the
 * on-demand enrichment below, POST /api/movies and scripts/backfill-tmdb.ts so
 * the paths cannot drift.
 */
export function relationalEnrichmentData(details: TmdbMovieDetails) {
  const director = details.credits?.crew.find((person) => person.job === "Director") ?? null;
  const genres = details.genres ?? [];
  const keywords = details.keywords?.keywords ?? [];
  const countries = (details.production_countries ?? [])
    .map((country) => country.iso_3166_1)
    .filter((code): code is string => Boolean(code));

  return {
    // `?? undefined` leaves an existing value untouched when TMDB omits it.
    runtime: details.runtime ?? undefined,
    originalLanguage: details.original_language ?? null,
    tmdbRating: details.vote_average ?? undefined,
    tmdbVoteCount: details.vote_count ?? undefined,
    countries,
    directorId: director?.id ?? null,
    directorName: director?.name ?? null,
    // `set` is declarative: it replaces the film's relations with the current
    // TMDB truth, so re-running enrichment stays correct and idempotent.
    genreList: { set: genres.map((genre) => ({ id: genre.id })) },
    keywords: { set: keywords.map((keyword) => ({ id: keyword.id })) },
  } satisfies Prisma.MovieUpdateInput;
}

/**
 * Create every Genre/Keyword row the given payloads reference in one atomic,
 * conflict-safe write per table, so the relation `set`s in
 * relationalEnrichmentData never race to insert the same taxonomy id (accepts
 * several films at once — the backfill batches them).
 */
export async function ensureTaxonomyRows(detailsList: TmdbMovieDetails[]): Promise<void> {
  const genres = new Map<number, string>();
  const keywords = new Map<number, string>();
  for (const details of detailsList) {
    for (const genre of details.genres ?? []) genres.set(genre.id, genre.name);
    for (const keyword of details.keywords?.keywords ?? []) keywords.set(keyword.id, keyword.name);
  }
  if (genres.size) {
    await prisma.genre.createMany({ data: [...genres].map(([id, name]) => ({ id, name })), skipDuplicates: true });
  }
  if (keywords.size) {
    await prisma.keyword.createMany({ data: [...keywords].map(([id, name]) => ({ id, name })), skipDuplicates: true });
  }
}

/**
 * Create or refresh the shared-catalog Movie for a TMDB id with FULL metadata:
 * the denormalized string fields plus the relational taste-analytics fields.
 * Used by POST /api/movies (film add) and the onboarding seed flow.
 */
export async function upsertEnrichedMovie(tmdbId: number): Promise<{ movie: Movie; created: boolean }> {
  const details = await getTmdbMovie(tmdbId);
  const metadata = toMovieMetadata(details);
  const existing = await prisma.movie.findUnique({ where: { tmdbId } });

  const base = existing
    ? await prisma.movie.update({
        where: { id: existing.id },
        data: {
          ...metadata,
          posterPath: existing.posterPath ?? metadata.posterPath,
        },
      })
    : await prisma.movie.create({ data: metadata });

  // Full enrichment on add: the same relational fields the TMDB backfill
  // writes (genre/keyword relations, countries, language, director), so films
  // added through the app never drop out of the taste analytics.
  await ensureTaxonomyRows([details]);
  const movie = await prisma.movie.update({ where: { id: base.id }, data: relationalEnrichmentData(details) });
  return { movie, created: !existing };
}

export async function enrichMovieMetadata(movieId: string): Promise<Movie | null> {
  const movie = await prisma.movie.findUnique({ where: { id: movieId } });
  if (!movie || !missingMetadata(movie)) return movie;

  const match = movie.tmdbId
    ? await getTmdbMovie(movie.tmdbId)
    : await searchTmdbMovie(movie.title, movie.year).then((result) => result ? getTmdbMovie(result.id) : null);
  if (!match) return movie;

  const metadata = toMovieMetadata(match);
  await ensureTaxonomyRows([match]);
  const relational = relationalEnrichmentData(match);
  const clash = await prisma.movie.findUnique({ where: { tmdbId: metadata.tmdbId }, select: { id: true } });
  const resolved = clash && clash.id !== movie.id ? metadataWithoutIdentity(metadata) : metadata;
  const data = {
    ...resolved,
    ...relational,
    title: movie.title,
    year: movie.year ?? resolved.year,
    letterboxdUri: movie.letterboxdUri,
    posterPath: movie.posterPath ?? resolved.posterPath,
    backdropPath: movie.backdropPath ?? resolved.backdropPath,
    preferredPosterPath: movie.preferredPosterPath,
    preferredBackdropPath: movie.preferredBackdropPath,
  };

  try {
    return await prisma.movie.update({ where: { id: movie.id }, data });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return prisma.movie.update({
        where: { id: movie.id },
        data: { ...metadataWithoutIdentity(metadata), ...relational, title: movie.title, year: movie.year ?? metadata.year },
      });
    }
    throw error;
  }
}

// (The old enrichStatsMoviesForUser render-path helper was removed: metadata is
// now filled after paint via POST /api/movies/enrich + <BackgroundEnrich/>.)
