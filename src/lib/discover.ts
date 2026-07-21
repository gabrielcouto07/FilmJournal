import { prisma } from "./prisma";
import { discoverTmdbMovies, getTmdbGenres } from "./tmdb";
import {
  assemblePicks,
  buildRationale,
  computeCoverage,
  COUNTRY_DOMAIN,
  decadeDomain,
  DIMENSION_ORDER,
  dismissalKey,
  findGaps,
  genreDomain,
  LANGUAGE_DOMAIN,
  type BlindSpotPick,
  type CandidateMovie,
  type CoverageFilm,
  type DomainBucket,
  type GapBucket,
  type GapDimension,
} from "./analytics/blindspots";

/**
 * Data layer for the blind-spot engine: loads the viewer's logged films and
 * dismissals from Prisma, pulls acclaimed candidates per gap from TMDB, and
 * lets the pure module (analytics/blindspots.ts) do all the reasoning.
 *
 * Not wrapped in unstable_cache: picks depend on dismissals and on TMDB
 * responses (already HTTP-cached ~6h by tmdbFetch), and /discover is a
 * force-dynamic page.
 */

export type DiscoverData = {
  totalFilms: number;
  focus: GapDimension | "auto";
  picks: BlindSpotPick[];
  /** True when TMDB was unreachable — the UI shows a soft failure state. */
  degraded: boolean;
};

/** How many gaps per dimension get a TMDB candidate query. */
const GAPS_TO_FILL_AUTO = 2; // 4 dimensions × 2 = ≤8 discover calls
const GAPS_TO_FILL_FOCUSED = 5;

/** Vote-count floor per dimension: international cinema legitimately has fewer votes. */
const VOTE_FLOORS: Record<GapDimension, number> = { decade: 800, genre: 800, country: 300, language: 300 };

function gapDiscoverParams(gap: GapBucket, currentYear: number): Record<string, string> {
  // Blind spots are about cinema history: films from the last full year onward
  // haven't settled into a reputation yet (early TMDB ratings run hot), so the
  // candidate window always ends at the previous year.
  const reputationCeiling = `${currentYear - 1}-12-31`;
  const params: Record<string, string> = {
    sort_by: "vote_average.desc",
    "vote_count.gte": String(VOTE_FLOORS[gap.dimension]),
    language: "pt-BR",
    "primary_release_date.lte": reputationCeiling,
    // The roulette default (region BR) would bias classic/foreign discovery;
    // an empty region is ignored by TMDB.
    region: "",
  };
  if (gap.dimension === "decade") {
    params["primary_release_date.gte"] = `${gap.key}-01-01`;
    const decadeEnd = `${Number(gap.key) + 9}-12-31`;
    params["primary_release_date.lte"] = decadeEnd < reputationCeiling ? decadeEnd : reputationCeiling;
  } else if (gap.dimension === "country") {
    params.with_origin_country = gap.key;
  } else if (gap.dimension === "language") {
    params.with_original_language = gap.key;
  } else {
    params.with_genres = gap.key;
  }
  return params;
}

async function candidatesForGap(gap: GapBucket, seenTmdbIds: Set<number>, currentYear: number): Promise<CandidateMovie[]> {
  const response = await discoverTmdbMovies(gapDiscoverParams(gap, currentYear));
  return response.results
    .filter((movie) => !seenTmdbIds.has(movie.id))
    .slice(0, 8)
    .map((movie) => ({
      tmdbId: movie.id,
      title: movie.title,
      year: movie.release_date ? Number(movie.release_date.slice(0, 4)) || null : null,
      posterPath: movie.poster_path ?? null,
      backdropPath: movie.backdrop_path ?? null,
      overview: movie.overview ?? null,
      rating: movie.vote_average ?? null,
      voteCount: movie.vote_count ?? null,
      genreIds: movie.genre_ids ?? [],
    }));
}

type GapContext = {
  films: CoverageFilm[];
  seenTmdbIds: Set<number>;
  gapsByDimension: Partial<Record<GapDimension, GapBucket[]>>;
  currentYear: number;
  degraded: boolean;
};

/** Shared groundwork: the viewer's films, exclusions, dismissals and gaps. */
async function loadGapContext(userId: string, focus?: GapDimension): Promise<GapContext> {
  // 1. The viewer's logged universe (watched, rated, or diary-logged films).
  const loggedMovies = await prisma.movie.findMany({
    where: {
      OR: [
        { userMovies: { some: { userId, OR: [{ watched: true }, { rating: { not: null } }] } } },
        { logs: { some: { userId } } },
      ],
    },
    select: {
      tmdbId: true,
      year: true,
      countries: true,
      originalLanguage: true,
      genreList: { select: { id: true } },
    },
  });

  // 2. Never recommend anything already logged — nor anything already on the
  //    watchlist (it's on the viewer's radar; a blind-spot pick should be new).
  const watchlisted = await prisma.userMovie.findMany({
    where: { userId, watchlist: true },
    select: { movie: { select: { tmdbId: true } } },
  });
  const seenTmdbIds = new Set<number>();
  for (const movie of loggedMovies) if (movie.tmdbId) seenTmdbIds.add(movie.tmdbId);
  for (const row of watchlisted) if (row.movie.tmdbId) seenTmdbIds.add(row.movie.tmdbId);

  // 3. Persisted "not interested" signals.
  const dismissals = await prisma.blindSpotDismissal.findMany({ where: { userId } });
  const dismissed = new Set(dismissals.map((row) => dismissalKey(row.dimension as GapDimension, row.gapKey)));

  const films: CoverageFilm[] = loggedMovies.map((movie) => ({
    year: movie.year,
    countries: movie.countries,
    originalLanguage: movie.originalLanguage,
    genreIds: movie.genreList.map((genre) => genre.id),
  }));

  // 4. Domains. The genre domain comes from TMDB's canonical (localized) list —
  //    the local Genre table only knows genres the viewer has already touched,
  //    which is exactly the wrong universe for finding blind spots.
  let degraded = false;
  let genreBuckets: DomainBucket[] = [];
  try {
    genreBuckets = genreDomain(await getTmdbGenres("pt-BR"));
  } catch {
    degraded = true; // genre dimension silently absent this round
  }
  const currentYear = new Date().getUTCFullYear();
  const domains: Record<GapDimension, DomainBucket[]> = {
    decade: decadeDomain(currentYear),
    country: COUNTRY_DOMAIN,
    language: LANGUAGE_DOMAIN,
    genre: genreBuckets,
  };

  // 5. Gaps per dimension.
  const dimensions = focus ? [focus] : DIMENSION_ORDER;
  const gapsByDimension: Partial<Record<GapDimension, GapBucket[]>> = {};
  for (const dimension of dimensions) {
    gapsByDimension[dimension] = findGaps({ dimension, domain: domains[dimension], coverage: computeCoverage(films, dimension), dismissed });
  }

  return { films, seenTmdbIds, gapsByDimension, currentYear, degraded };
}

/** Fetch candidate pools for the given gaps; TMDB failures degrade per-gap. */
async function fetchCandidates(context: GapContext, gaps: GapBucket[]): Promise<Map<string, CandidateMovie[]>> {
  const candidates = new Map<string, CandidateMovie[]>();
  await Promise.all(gaps.map(async (gap) => {
    try {
      candidates.set(dismissalKey(gap.dimension, gap.key), await candidatesForGap(gap, context.seenTmdbIds, context.currentYear));
    } catch {
      context.degraded = true; // this gap simply yields no pick this round
    }
  }));
  return candidates;
}

export async function getDiscoverPicks(userId: string, focus?: GapDimension): Promise<DiscoverData> {
  const context = await loadGapContext(userId, focus);
  const gapsToFill = focus ? GAPS_TO_FILL_FOCUSED : GAPS_TO_FILL_AUTO;
  const dimensions = focus ? [focus] : DIMENSION_ORDER;
  const targets = dimensions.flatMap((dimension) => (context.gapsByDimension[dimension] ?? []).slice(0, gapsToFill));
  const candidates = await fetchCandidates(context, targets);

  return {
    totalFilms: context.films.length,
    focus: focus ?? "auto",
    picks: assemblePicks({ gapsByDimension: context.gapsByDimension, candidates, totalFilms: context.films.length }),
    degraded: context.degraded,
  };
}

// ------------------------------------------------------------ roulette pool

export type BlindSpotPoolEntry = CandidateMovie & {
  dimension: GapDimension;
  gapLabel: string;
  rationale: string;
};

/**
 * A wider blind-spot sample for the roulette: instead of one pick per gap it
 * flattens every candidate of the top gaps, so a spin has a real pool to land
 * on. Each entry keeps its gap + rationale so the reveal can explain the win.
 */
export async function getBlindSpotPool(
  userId: string,
  options: { count: number; yearFrom?: number; yearTo?: number; genreIds?: number[] },
): Promise<BlindSpotPoolEntry[]> {
  const context = await loadGapContext(userId);
  const targets = DIMENSION_ORDER.flatMap((dimension) => (context.gapsByDimension[dimension] ?? []).slice(0, GAPS_TO_FILL_AUTO));
  const candidates = await fetchCandidates(context, targets);

  const entries: BlindSpotPoolEntry[] = [];
  const used = new Set<number>();
  for (const gap of targets) {
    for (const movie of candidates.get(dismissalKey(gap.dimension, gap.key)) ?? []) {
      if (used.has(movie.tmdbId)) continue;
      if (options.yearFrom && (movie.year ?? 0) < options.yearFrom) continue;
      if (options.yearTo && (movie.year ?? 9999) > options.yearTo) continue;
      if (options.genreIds?.length && !movie.genreIds.some((id) => options.genreIds!.includes(id))) continue;
      used.add(movie.tmdbId);
      entries.push({
        ...movie,
        dimension: gap.dimension,
        gapLabel: gap.label,
        rationale: buildRationale(gap, context.films.length, movie),
      });
    }
  }

  // Fisher-Yates shuffle so repeated spins vary even with identical gaps.
  for (let i = entries.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [entries[i], entries[j]] = [entries[j], entries[i]];
  }
  return entries.slice(0, options.count);
}

/** Persist a "not interested" signal (gapKey "*" mutes the whole dimension). */
export async function dismissBlindSpot(userId: string, dimension: GapDimension, gapKey: string): Promise<void> {
  await prisma.blindSpotDismissal.upsert({
    where: { userId_dimension_gapKey: { userId, dimension, gapKey } },
    create: { userId, dimension, gapKey },
    update: {},
  });
}
