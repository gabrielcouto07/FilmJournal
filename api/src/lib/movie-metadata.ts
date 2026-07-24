import { Prisma, type Movie } from "@prisma/client";
import { prisma } from "./prisma.js";
import { getTmdbMovie, searchTmdbMovie, toMovieMetadata, type TmdbMovieDetails } from "./tmdb.js";

function missingMetadata(movie: Movie) {
  // `originalLanguage` marca que as relações do TMDB já foram preenchidas.
  return !movie.posterPath || !movie.tmdbId || !movie.genres || !movie.directors || !movie.originalLanguage;
}

function metadataWithoutIdentity(metadata: ReturnType<typeof toMovieMetadata>) {
  const { tmdbId, imdbId, ...shared } = metadata;
  void tmdbId;
  void imdbId;
  return shared;
}

/** Monta os campos e relações de análise a partir dos detalhes do TMDB. */
export function relationalEnrichmentData(details: TmdbMovieDetails) {
  const director = details.credits?.crew.find((person) => person.job === "Director") ?? null;
  const genres = details.genres ?? [];
  const keywords = details.keywords?.keywords ?? [];
  const countries = (details.production_countries ?? [])
    .map((country) => country.iso_3166_1)
    .filter((code): code is string => Boolean(code));

  return {
    // `undefined` preserva o valor atual quando o TMDB omite o campo.
    runtime: details.runtime ?? undefined,
    originalLanguage: details.original_language ?? null,
    tmdbRating: details.vote_average ?? undefined,
    tmdbVoteCount: details.vote_count ?? undefined,
    countries,
    directorId: director?.id ?? null,
    directorName: director?.name ?? null,
    // `set` substitui as relações pela versão atual do TMDB.
    genreList: { set: genres.map((genre) => ({ id: genre.id })) },
    keywords: { set: keywords.map((keyword) => ({ id: keyword.id })) },
  } satisfies Prisma.MovieUpdateInput;
}

/** Cria gêneros e palavras-chave em lote antes de ligar as relações. */
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

/** Cria ou atualiza um filme do catálogo com todos os dados do TMDB. */
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

  // Já salva as relações usadas nas análises ao adicionar o filme.
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

// O enriquecimento roda depois da tela abrir, pela rota de metadados.
