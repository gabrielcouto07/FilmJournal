/**
 * Palate analytics — pure, Prisma-free aggregation over a viewer's rated films.
 *
 * Every function here takes plain data (a `PalateFilm[]`) and returns plain
 * data, so the whole module is unit-testable without a database. The Prisma
 * read that produces `PalateFilm[]` lives in the data layer
 * (`getPalateFilms` in src/lib/data.ts); components render the results but never
 * compute them.
 *
 * Rating scales: the viewer rates on 0–5 (half stars). TMDB's crowd rating
 * (`vote_average`) is 0–10. The contrarian analysis puts both on the 0–5 scale
 * so "you vs the crowd" is an apples-to-apples comparison.
 */

/** The viewer's 0–5 star scale. */
export const USER_SCALE_MAX = 5;
/** TMDB `vote_average` scale. */
export const CROWD_SCALE_MAX = 10;
/** Films need at least this many TMDB votes to count as "the crowd". */
export const MIN_CROWD_VOTES = 50;
/** A director must reach this many rated films to count as "loyalty". */
export const DIRECTOR_LOYALTY_MIN = 3;

/** One rated film, already flattened from Prisma into analytics-ready fields. */
export type PalateFilm = {
  id: string;
  title: string;
  year: number | null;
  /** Viewer rating on the 0–5 scale (guaranteed present — callers filter nulls). */
  userRating: number;
  /** TMDB vote_average on the raw 0–10 scale, or null when unknown. */
  crowdRating: number | null;
  /** TMDB vote_count, used to gate low-confidence crowd ratings. */
  crowdVotes: number | null;
  runtime: number | null;
  /** ISO 3166-1 country codes. */
  countries: string[];
  /** TMDB genre names. */
  genres: string[];
  directorId: number | null;
  directorName: string | null;
};

/** Put a 0–10 crowd rating on the viewer's 0–5 scale. */
export function normalizeCrowdRating(crowd: number): number {
  return crowd * (USER_SCALE_MAX / CROWD_SCALE_MAX);
}

/** Arithmetic mean (0 for an empty list). Shared with timeline.ts. */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Round to `places` decimals. Shared with timeline.ts. */
export function round(value: number, places = 2): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

// ------------------------------------------------------------ contrarian

export type ContrarianPoint = {
  id: string;
  title: string;
  year: number | null;
  /** Viewer rating, 0–5. */
  userRating: number;
  /** Crowd rating normalized to 0–5. */
  crowdRating: number;
  /** userRating − crowdRating. Positive = you liked it more than the crowd. */
  delta: number;
};

export type Contrarian = {
  points: ContrarianPoint[];
  /** Mean absolute disagreement with the crowd (0 = you always agree). */
  contrarianScore: number;
  /** Mean signed gap. Positive = you rate more generously than the crowd. */
  tasteLean: number;
  /** Films you rate far ABOVE the crowd, most contrarian first. */
  loves: ContrarianPoint[];
  /** Films you rate far BELOW the crowd, most contrarian first. */
  pans: ContrarianPoint[];
  sampleSize: number;
};

/**
 * Compare each film's viewer rating against the crowd. Only films with a crowd
 * rating backed by at least MIN_CROWD_VOTES votes qualify, so a single stray
 * vote can't masquerade as consensus.
 */
export function computeContrarian(films: PalateFilm[], listSize = 5): Contrarian {
  const points: ContrarianPoint[] = films
    .filter((film) => film.crowdRating != null && (film.crowdVotes ?? 0) >= MIN_CROWD_VOTES)
    .map((film) => {
      const crowdRating = round(normalizeCrowdRating(film.crowdRating as number));
      return {
        id: film.id,
        title: film.title,
        year: film.year,
        userRating: film.userRating,
        crowdRating,
        delta: round(film.userRating - crowdRating),
      };
    });

  const deltas = points.map((point) => point.delta);
  const loves = points
    .filter((point) => point.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, listSize);
  const pans = points
    .filter((point) => point.delta < 0)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, listSize);

  return {
    points,
    contrarianScore: round(mean(deltas.map(Math.abs))),
    tasteLean: round(mean(deltas)),
    loves,
    pans,
    sampleSize: points.length,
  };
}

// --------------------------------------------------------------- decades

export type DecadeBucket = { decade: number; label: string; count: number };

/** Count films per decade, oldest first. Films without a year are ignored. */
export function computeDecades(films: PalateFilm[]): DecadeBucket[] {
  const counts = new Map<number, number>();
  for (const film of films) {
    if (film.year == null) continue;
    const decade = Math.floor(film.year / 10) * 10;
    counts.set(decade, (counts.get(decade) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([decade, count]) => ({ decade, label: `${decade}s`, count }));
}

// ------------------------------------------------------------- countries

export type CountryCount = { code: string; count: number };

/**
 * Count films per production country, most-watched first. A co-production
 * counts once for each of its countries.
 */
export function computeCountries(films: PalateFilm[], limit?: number): CountryCount[] {
  const counts = new Map<string, number>();
  for (const film of films) {
    for (const code of film.countries) {
      if (!code) continue;
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }
  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([code, count]) => ({ code, count }));
  return limit ? ranked.slice(0, limit) : ranked;
}

// ---------------------------------------------------------------- genres

export type GenreCount = { genre: string; count: number };

/** Count films per genre, most-watched first. */
export function computeGenres(films: PalateFilm[], limit?: number): GenreCount[] {
  const counts = new Map<string, number>();
  for (const film of films) {
    for (const genre of film.genres) {
      if (!genre) continue;
      counts.set(genre, (counts.get(genre) ?? 0) + 1);
    }
  }
  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([genre, count]) => ({ genre, count }));
  return limit ? ranked.slice(0, limit) : ranked;
}

// -------------------------------------------------------------- runtimes

export type RuntimeBucket = {
  label: string;
  /** Inclusive lower bound in minutes. */
  min: number;
  /** Exclusive upper bound in minutes, or null for the open-ended top bucket. */
  max: number | null;
  count: number;
  /** True for the single most-populated bucket (the viewer's sweet spot). */
  sweetSpot: boolean;
};

const RUNTIME_BUCKETS: Array<{ label: string; min: number; max: number | null }> = [
  { label: "< 90", min: 0, max: 90 },
  { label: "90–104", min: 90, max: 105 },
  { label: "105–119", min: 105, max: 120 },
  { label: "120–134", min: 120, max: 135 },
  { label: "135–149", min: 135, max: 150 },
  { label: "150+", min: 150, max: null },
];

/**
 * Bucket films by runtime and flag the modal bucket as the sweet spot. Films
 * without a runtime are ignored.
 */
export function computeRuntimes(films: PalateFilm[]): RuntimeBucket[] {
  const counts = RUNTIME_BUCKETS.map((bucket) => ({ ...bucket, count: 0, sweetSpot: false }));
  for (const film of films) {
    if (film.runtime == null || film.runtime <= 0) continue;
    const bucket = counts.find((candidate) => film.runtime! >= candidate.min && (candidate.max == null || film.runtime! < candidate.max));
    if (bucket) bucket.count += 1;
  }
  const peak = counts.reduce((best, bucket) => (bucket.count > best ? bucket.count : best), 0);
  if (peak > 0) {
    const sweet = counts.find((bucket) => bucket.count === peak);
    if (sweet) sweet.sweetSpot = true;
  }
  return counts;
}

// ------------------------------------------------------------- directors

export type DirectorLoyalty = {
  directorId: number | null;
  name: string;
  count: number;
  /** Mean viewer rating across this director's rated films, 0–5. */
  averageRating: number;
};

/**
 * Directors the viewer keeps returning to (at least DIRECTOR_LOYALTY_MIN rated
 * films), ranked by film count then by how highly the viewer rates them.
 */
export function computeDirectorLoyalty(films: PalateFilm[]): DirectorLoyalty[] {
  const groups = new Map<string, { directorId: number | null; name: string; ratings: number[] }>();
  for (const film of films) {
    if (!film.directorName) continue;
    const key = film.directorId != null ? `id:${film.directorId}` : `name:${film.directorName.toLowerCase()}`;
    const group = groups.get(key) ?? { directorId: film.directorId, name: film.directorName, ratings: [] };
    group.ratings.push(film.userRating);
    groups.set(key, group);
  }
  return [...groups.values()]
    .filter((group) => group.ratings.length >= DIRECTOR_LOYALTY_MIN)
    .map((group) => ({
      directorId: group.directorId,
      name: group.name,
      count: group.ratings.length,
      averageRating: round(mean(group.ratings)),
    }))
    .sort((a, b) => b.count - a.count || b.averageRating - a.averageRating || a.name.localeCompare(b.name));
}

// ----------------------------------------------------------------- palate

export type Palate = {
  totalFilms: number;
  contrarian: Contrarian;
  decades: DecadeBucket[];
  countries: CountryCount[];
  genres: GenreCount[];
  runtimes: RuntimeBucket[];
  directors: DirectorLoyalty[];
};

/** Compute every palate aggregate in one pass-friendly call. */
export function computePalate(films: PalateFilm[]): Palate {
  return {
    totalFilms: films.length,
    contrarian: computeContrarian(films),
    decades: computeDecades(films),
    countries: computeCountries(films),
    genres: computeGenres(films),
    runtimes: computeRuntimes(films),
    directors: computeDirectorLoyalty(films),
  };
}
