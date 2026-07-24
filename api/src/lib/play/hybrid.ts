/** Regras puras de comparação, pistas e pontuação do Cine-Detetive. */

export const MAX_GUESSES = 10;
/** Atores liberados como pistas, do menos para o mais conhecido. */
export const CAST_REVEALS = 5;
/** Quantidade de atores usada na comparação de elenco. */
export const CAST_OVERLAP_POOL = 10;
export const HINT_KEYWORDS_AT = 5;
export const HINT_TAGLINE_AT = 8;
export const POSTER_AT = 7;
export const POSTER_MEDIUM_AT = 8;
export const POSTER_LIGHT_AT = 9;
export const YEAR_CLOSE_WINDOW = 5;
export const RATING_EXACT_WINDOW = 0.3;
export const RATING_CLOSE_WINDOW = 1.0;
/** Atores em comum necessários para uma comparação exata. */
export const CAST_EXACT_MIN = 3;
/** Dicas disponíveis por rodada. */
export const HINT_COUNT = 2;

import type { TmdbMovieDetails } from "../tmdb.js";

export type CastMember = { id: number; name: string; profilePath: string | null };

/** Dados necessários para comparar um filme. */
export type MovieProfile = {
  tmdbId: number;
  title: string;
  year: number | null;
  genres: Array<{ id: number; name: string }>;
  directorId: number | null;
  directorName: string | null;
  /** Produtoras em ordem; a primeira é a principal. */
  companies: Array<{ id: number; name: string }>;
  /** Nota do TMDB entre 0 e 10. */
  rating: number | null;
  /** Elenco principal na ordem de crédito. */
  cast: CastMember[];
};

/** Converte os detalhes do TMDB no perfil usado pelo jogo. */
export function profileFromDetails(details: TmdbMovieDetails): MovieProfile {
  const director = details.credits?.crew.find((person) => person.job === "Director") ?? null;
  return {
    tmdbId: details.id,
    title: details.title,
    year: details.release_date ? Number(details.release_date.slice(0, 4)) || null : null,
    genres: details.genres ?? [],
    directorId: director?.id ?? null,
    directorName: director?.name ?? null,
    companies: (details.production_companies ?? []).slice(0, 5),
    rating: details.vote_average ?? null,
    cast: (details.credits?.cast ?? [])
      .slice()
      .sort((left, right) => left.order - right.order)
      .slice(0, CAST_OVERLAP_POOL)
      .map((person) => ({ id: person.id, name: person.name, profilePath: person.profile_path ?? null })),
  };
}

export type TileGrade = "exact" | "close" | "miss";
/** Direção do filme secreto em relação ao palpite. */
export type Direction = "target-higher" | "target-lower" | null;

export type GuessTiles = {
  year: { grade: TileGrade; guessYear: number | null; direction: Direction };
  genres: { grade: TileGrade; guessGenres: string[]; shared: string[] };
  director: { grade: TileGrade; guessDirector: string | null };
  studio: { grade: TileGrade; guessStudio: string | null; shared: string[] };
  rating: { grade: TileGrade; guessRating: number | null; direction: Direction };
  cast: { grade: TileGrade; guessPrincipal: string | null; shared: string[] };
};

export type GuessGrade = { correct: boolean; tiles: GuessTiles };

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function numericTile(
  guessValue: number | null,
  targetValue: number | null,
  exactWindow: number,
  closeWindow: number,
): { grade: TileGrade; direction: Direction } {
  if (guessValue == null || targetValue == null) return { grade: "miss", direction: null };
  const delta = targetValue - guessValue;
  const grade: TileGrade = Math.abs(delta) <= exactWindow ? "exact" : Math.abs(delta) <= closeWindow ? "close" : "miss";
  const direction: Direction = grade === "exact" ? null : delta > 0 ? "target-higher" : "target-lower";
  return { grade, direction };
}

/** Compara um palpite com o filme secreto nos seis critérios. */
export function gradeGuess(guess: MovieProfile, target: MovieProfile): GuessGrade {
  // Ano exato ou próximo, com seta na direção do filme secreto.
  const year = numericTile(guess.year, target.year, 0, YEAR_CLOSE_WINDOW);

  // Gêneros iguais são exatos; qualquer gênero em comum fica próximo.
  const targetGenreIds = new Set(target.genres.map((genre) => genre.id));
  const sharedGenres = guess.genres.filter((genre) => targetGenreIds.has(genre.id));
  const setsEqual =
    guess.genres.length > 0 &&
    guess.genres.length === target.genres.length &&
    sharedGenres.length === target.genres.length;
  const genres = {
    grade: (setsEqual ? "exact" : sharedGenres.length > 0 ? "close" : "miss") as TileGrade,
    guessGenres: guess.genres.map((genre) => genre.name),
    shared: sharedGenres.map((genre) => genre.name),
  };

  // Diretor só aceita igualdade; usa o nome quando falta ID.
  const directorMatch =
    guess.directorId != null && target.directorId != null
      ? guess.directorId === target.directorId
      : Boolean(
          guess.directorName &&
          target.directorName &&
          guess.directorName.trim().toLowerCase() === target.directorName.trim().toLowerCase(),
        );
  const director = {
    grade: (directorMatch ? "exact" : "miss") as TileGrade,
    guessDirector: guess.directorName,
  };

  // Produtora principal igual é exato; qualquer produtora em comum fica próxima.
  const targetCompanyIds = new Set(target.companies.map((company) => company.id));
  const sharedCompanies = guess.companies.filter((company) => targetCompanyIds.has(company.id));
  const primaryMatch =
    guess.companies.length > 0 && target.companies.length > 0 && guess.companies[0].id === target.companies[0].id;
  const studio = {
    grade: (primaryMatch ? "exact" : sharedCompanies.length > 0 ? "close" : "miss") as TileGrade,
    guessStudio: guess.companies[0]?.name ?? null,
    shared: sharedCompanies.map((company) => company.name),
  };

  // A nota usa janelas diferentes para exato e próximo.
  const rating = numericTile(guess.rating, target.rating, RATING_EXACT_WINDOW, RATING_CLOSE_WINDOW);

  // Atores em comum também aparecem como pistas.
  const guessCastIds = new Set(guess.cast.slice(0, CAST_OVERLAP_POOL).map((member) => member.id));
  const sharedCast = target.cast
    .slice(0, CAST_OVERLAP_POOL)
    .filter((member) => guessCastIds.has(member.id));
  const cast = {
    grade: (sharedCast.length >= CAST_EXACT_MIN ? "exact" : sharedCast.length > 0 ? "close" : "miss") as TileGrade,
    guessPrincipal: guess.cast[0]?.name ?? null,
    shared: sharedCast.map((member) => member.name),
  };

  return {
    correct: guess.tmdbId === target.tmdbId,
    tiles: {
      year: { grade: year.grade, guessYear: guess.year, direction: year.direction },
      genres,
      director,
      studio,
      rating: { grade: rating.grade, guessRating: guess.rating, direction: rating.direction },
      cast,
    },
  };
}

// Liberação das pistas

/** Quantos atores ficam visíveis em cada palpite. */
export function actorsVisible(guessNumber: number, castCount: number): number {
  const n = clamp(guessNumber, 1, MAX_GUESSES);
  const scheduled = n <= 4 ? n : n === 5 ? 4 : CAST_REVEALS;
  return Math.min(scheduled, Math.min(castCount, CAST_REVEALS));
}

export type PosterStage = "hidden" | "heavy" | "medium" | "light";

/** Nível de desfoque do pôster em cada palpite. */
export function posterStage(guessNumber: number): PosterStage {
  const n = clamp(guessNumber, 1, MAX_GUESSES);
  if (n < POSTER_AT) return "hidden";
  if (n < POSTER_MEDIUM_AT) return "heavy";
  if (n < POSTER_LIGHT_AT) return "medium";
  return "light";
}

/** Indica se uma dica já foi liberada. */
export function hintUnlocked(hint: 1 | 2, guessNumber: number): boolean {
  const n = clamp(guessNumber, 1, MAX_GUESSES);
  return hint === 1 ? n >= HINT_KEYWORDS_AT : n >= HINT_TAGLINE_AT;
}

/** Ordena as pistas de elenco do nome menos para o mais conhecido. */
export function revealOrder<T>(castBillingOrder: T[]): T[] {
  return castBillingOrder.slice(0, CAST_REVEALS).reverse();
}

// Pontuação

/** Menos palpites e dicas não usadas rendem mais pontos; derrota vale zero. */
export function computeHybridScore(options: { solved: boolean; guessesUsed: number; hintsUsed: number }): number {
  if (!options.solved) return 0;
  const guesses = clamp(options.guessesUsed, 1, MAX_GUESSES);
  const hints = clamp(options.hintsUsed, 0, HINT_COUNT);
  return 1000 - (guesses - 1) * 100 + (HINT_COUNT - hints) * 50;
}

// Sorteio diário

/** Chave UTC que mantém o mesmo filme do dia para todos. */
export function dailyKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Gera uma semente estável de 32 bits com FNV-1a. */
export function dailySeed(key: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
