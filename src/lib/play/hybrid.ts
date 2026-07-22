/**
 * Cine-Detetive — pure grading, reveal-schedule and scoring logic for the
 * hybrid guessing game (spotle.movie-inspired). No I/O here so everything is
 * unit-testable (tests/play-hybrid.test.ts). The round token / TMDB plumbing
 * lives in src/lib/play/token.ts and the /api/play routes.
 *
 * Owner sign-off (2026-07-22):
 * - Reveal schedule: cast least-billed → top-billed on guesses 1–4 and 6;
 *   optional hints at 5 (keywords) and 8 (tagline); poster enters heavily
 *   blurred at 7, medium at 8, light at 9, clear only at win/loss.
 * - Tiles: year ±5 = close (with direction); genres set-equal = exact,
 *   ≥1 shared = close; director exact-only; studio primary = exact, any
 *   shared company = close; TMDB score ±0.3 exact / ±1.0 close (direction);
 *   cast overlap over the top-10 pool: ≥3 exact, 1–2 close (names shown).
 * - The old timed cast quiz was replaced by this game (owner's call).
 */

export const MAX_GUESSES = 10;
/** Actors used as progressive identity clues (billed #5 → #1). */
export const CAST_REVEALS = 5;
/** Top-billed pool compared for the cast-overlap tile. */
export const CAST_OVERLAP_POOL = 10;
export const HINT_KEYWORDS_AT = 5;
export const HINT_TAGLINE_AT = 8;
export const POSTER_AT = 7;
export const POSTER_MEDIUM_AT = 8;
export const POSTER_LIGHT_AT = 9;
export const YEAR_CLOSE_WINDOW = 5;
export const RATING_EXACT_WINDOW = 0.3;
export const RATING_CLOSE_WINDOW = 1.0;
/** Shared cast members needed for a green cast tile. */
export const CAST_EXACT_MIN = 3;
/** Hints available per round (keywords, tagline). */
export const HINT_COUNT = 2;

import type { TmdbMovieDetails } from "../tmdb";

export type CastMember = { id: number; name: string; profilePath: string | null };

/** Everything a movie needs to be graded — both guesses and the target. */
export type MovieProfile = {
  tmdbId: number;
  title: string;
  year: number | null;
  genres: Array<{ id: number; name: string }>;
  directorId: number | null;
  directorName: string | null;
  /** Production companies in billing order — [0] is the primary studio. */
  companies: Array<{ id: number; name: string }>;
  /** TMDB vote_average on the raw 0–10 scale. */
  rating: number | null;
  /** Top-billed cast, billing order, up to CAST_OVERLAP_POOL entries. */
  cast: CastMember[];
};

/**
 * Flatten a TMDB details payload (the shared getTmdbMovie fetch shape) into a
 * grading profile. Pure mapping — the type import is erased at compile time.
 */
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
/** Where the target sits relative to the guess (the arrow on the tile). */
export type Direction = "target-higher" | "target-lower" | null;

export type GuessTiles = {
  year: { grade: TileGrade; guessYear: number | null; direction: Direction };
  genres: { grade: TileGrade; guessGenres: string[]; shared: string[] };
  director: { grade: TileGrade; guessDirector: string | null };
  studio: { grade: TileGrade; guessStudio: string | null; shared: string[] };
  rating: { grade: TileGrade; guessRating: number | null; direction: Direction };
  cast: { grade: TileGrade; shared: string[] };
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

/** Grade one guessed movie against the target across the six tiles. */
export function gradeGuess(guess: MovieProfile, target: MovieProfile): GuessGrade {
  // Year: exact same year, close within ±YEAR_CLOSE_WINDOW, arrow toward target.
  const year = numericTile(guess.year, target.year, 0, YEAR_CLOSE_WINDOW);

  // Genres: identical sets (by id) = exact; any overlap = close.
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

  // Director: exact-only — same TMDB person id, falling back to the name when
  // an id is missing on either side.
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

  // Studio: same primary company = exact; any shared company = close.
  const targetCompanyIds = new Set(target.companies.map((company) => company.id));
  const sharedCompanies = guess.companies.filter((company) => targetCompanyIds.has(company.id));
  const primaryMatch =
    guess.companies.length > 0 && target.companies.length > 0 && guess.companies[0].id === target.companies[0].id;
  const studio = {
    grade: (primaryMatch ? "exact" : sharedCompanies.length > 0 ? "close" : "miss") as TileGrade,
    guessStudio: guess.companies[0]?.name ?? null,
    shared: sharedCompanies.map((company) => company.name),
  };

  // TMDB score: ±RATING_EXACT_WINDOW exact, ±RATING_CLOSE_WINDOW close.
  const rating = numericTile(guess.rating, target.rating, RATING_EXACT_WINDOW, RATING_CLOSE_WINDOW);

  // Cast overlap over the top-billed pools; shared names double as clues.
  const guessCastIds = new Set(guess.cast.slice(0, CAST_OVERLAP_POOL).map((member) => member.id));
  const sharedCast = target.cast
    .slice(0, CAST_OVERLAP_POOL)
    .filter((member) => guessCastIds.has(member.id));
  const cast = {
    grade: (sharedCast.length >= CAST_EXACT_MIN ? "exact" : sharedCast.length > 0 ? "close" : "miss") as TileGrade,
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

// ------------------------------------------------------------ reveal schedule

/**
 * How many identity-clue actors are visible while MAKING guess `guessNumber`.
 * G1–G4 reveal one per guess (billed #5 → #2), G5 pauses (hint 1 unlocks),
 * G6 reveals the top-billed name. Capped by how many actors the movie has.
 */
export function actorsVisible(guessNumber: number, castCount: number): number {
  const n = clamp(guessNumber, 1, MAX_GUESSES);
  const scheduled = n <= 4 ? n : n === 5 ? 4 : CAST_REVEALS;
  return Math.min(scheduled, Math.min(castCount, CAST_REVEALS));
}

export type PosterStage = "hidden" | "heavy" | "medium" | "light";

/** Poster blur stage while making guess `guessNumber` (clear only at the end). */
export function posterStage(guessNumber: number): PosterStage {
  const n = clamp(guessNumber, 1, MAX_GUESSES);
  if (n < POSTER_AT) return "hidden";
  if (n < POSTER_MEDIUM_AT) return "heavy";
  if (n < POSTER_LIGHT_AT) return "medium";
  return "light";
}

/** Whether an optional hint (1 = keywords, 2 = tagline) is unlocked at a guess. */
export function hintUnlocked(hint: 1 | 2, guessNumber: number): boolean {
  const n = clamp(guessNumber, 1, MAX_GUESSES);
  return hint === 1 ? n >= HINT_KEYWORDS_AT : n >= HINT_TAGLINE_AT;
}

/**
 * The identity-clue reveal order: the first CAST_REVEALS billed actors,
 * reversed, so clues escalate from least to most famous.
 */
export function revealOrder<T>(castBillingOrder: T[]): T[] {
  return castBillingOrder.slice(0, CAST_REVEALS).reverse();
}

// ------------------------------------------------------------------- scoring

/**
 * Final score: fewer guesses = more points (1000 → 100 across the 10),
 * +50 per unused hint. A lost round scores 0.
 */
export function computeHybridScore(options: { solved: boolean; guessesUsed: number; hintsUsed: number }): number {
  if (!options.solved) return 0;
  const guesses = clamp(options.guessesUsed, 1, MAX_GUESSES);
  const hints = clamp(options.hintsUsed, 0, HINT_COUNT);
  return 1000 - (guesses - 1) * 100 + (HINT_COUNT - hints) * 50;
}

// ---------------------------------------------------------------- daily seed

/** UTC day key ("2026-07-22") — the whole world shares one movie per day. */
export function dailyKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** FNV-1a over the day key: a stable, well-spread 32-bit seed. */
export function dailySeed(key: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
