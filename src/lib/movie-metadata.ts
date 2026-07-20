import { Prisma, type Movie } from "@prisma/client";
import { prisma } from "./prisma";
import { getTmdbMovie, searchTmdbMovie, toMovieMetadata } from "./tmdb";

function missingMetadata(movie: Movie) {
  return !movie.posterPath || !movie.tmdbId || !movie.genres || !movie.directors;
}

function metadataWithoutIdentity(metadata: ReturnType<typeof toMovieMetadata>) {
  const { tmdbId, imdbId, ...shared } = metadata;
  void tmdbId;
  void imdbId;
  return shared;
}

export async function enrichMovieMetadata(movieId: string): Promise<Movie | null> {
  const movie = await prisma.movie.findUnique({ where: { id: movieId } });
  if (!movie || !missingMetadata(movie)) return movie;

  const match = movie.tmdbId
    ? await getTmdbMovie(movie.tmdbId)
    : await searchTmdbMovie(movie.title, movie.year).then((result) => result ? getTmdbMovie(result.id) : null);
  if (!match) return movie;

  const metadata = toMovieMetadata(match);
  const clash = await prisma.movie.findUnique({ where: { tmdbId: metadata.tmdbId }, select: { id: true } });
  const resolved = clash && clash.id !== movie.id ? metadataWithoutIdentity(metadata) : metadata;
  const data = {
    ...resolved,
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
        data: { ...metadataWithoutIdentity(metadata), title: movie.title, year: movie.year ?? metadata.year },
      });
    }
    throw error;
  }
}

// (The old enrichStatsMoviesForUser render-path helper was removed: metadata is
// now filled after paint via POST /api/movies/enrich + <BackgroundEnrich/>.)
