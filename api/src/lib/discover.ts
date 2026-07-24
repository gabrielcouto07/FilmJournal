import { prisma } from "./prisma.js";
import { discoverTmdbMovies, getTmdbGenres } from "./tmdb.js";
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
} from "./analytics/blindspots.js";

/** Carrega o histórico e busca no TMDB candidatos para os pontos cegos. */

export type DiscoverData = {
  totalFilms: number;
  focus: GapDimension | "auto";
  picks: BlindSpotPick[];
  /** Indica que o TMDB não respondeu. */
  degraded: boolean;
};

/** Quantos pontos cegos de cada dimensão recebem candidatos. */
const GAPS_TO_FILL_AUTO = 2; // 4 dimensions × 2 = ≤8 discover calls
const GAPS_TO_FILL_FOCUSED = 5;

/** Mínimo de votos por dimensão; cinema internacional costuma ter menos votos. */
const VOTE_FLOORS: Record<GapDimension, number> = { decade: 800, genre: 800, country: 300, language: 300 };

function gapDiscoverParams(gap: GapBucket, currentYear: number): Record<string, string> {
  // Filmes muito recentes ainda não têm reputação estável e ficam de fora.
  const reputationCeiling = `${currentYear - 1}-12-31`;
  const params: Record<string, string> = {
    sort_by: "vote_average.desc",
    "vote_count.gte": String(VOTE_FLOORS[gap.dimension]),
    language: "pt-BR",
    "primary_release_date.lte": reputationCeiling,
    // Sem região, a busca não favorece lançamentos disponíveis no Brasil.
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

/** Reúne filmes, exclusões e pontos cegos do usuário. */
async function loadGapContext(userId: string, focus?: GapDimension): Promise<GapContext> {
  // 1. Filmes já vistos, avaliados ou registrados.
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

  // 2. Não recomenda filmes já registrados nem os que estão na lista.
  const watchlisted = await prisma.userMovie.findMany({
    where: { userId, watchlist: true },
    select: { movie: { select: { tmdbId: true } } },
  });
  const seenTmdbIds = new Set<number>();
  for (const movie of loggedMovies) if (movie.tmdbId) seenTmdbIds.add(movie.tmdbId);
  for (const row of watchlisted) if (row.movie.tmdbId) seenTmdbIds.add(row.movie.tmdbId);

  // 3. Preferências marcadas como "não tenho interesse".
  const dismissals = await prisma.blindSpotDismissal.findMany({ where: { userId } });
  const dismissed = new Set(dismissals.map((row) => dismissalKey(row.dimension as GapDimension, row.gapKey)));

  const films: CoverageFilm[] = loggedMovies.map((movie) => ({
    year: movie.year,
    countries: movie.countries,
    originalLanguage: movie.originalLanguage,
    genreIds: movie.genreList.map((genre) => genre.id),
  }));

  // 4. Usa todos os gêneros do TMDB, não só os que já aparecem no diário.
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

  // 5. Pontos cegos por dimensão.
  const dimensions = focus ? [focus] : DIMENSION_ORDER;
  const gapsByDimension: Partial<Record<GapDimension, GapBucket[]>> = {};
  for (const dimension of dimensions) {
    gapsByDimension[dimension] = findGaps({ dimension, domain: domains[dimension], coverage: computeCoverage(films, dimension), dismissed });
  }

  return { films, seenTmdbIds, gapsByDimension, currentYear, degraded };
}

/** Busca candidatos para cada ponto cego sem derrubar os demais em caso de falha. */
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
  const start = performance.now();
  const context = await loadGapContext(userId, focus);
  const contextMs = Math.round(performance.now() - start);
  const gapsToFill = focus ? GAPS_TO_FILL_FOCUSED : GAPS_TO_FILL_AUTO;
  const dimensions = focus ? [focus] : DIMENSION_ORDER;
  const targets = dimensions.flatMap((dimension) => (context.gapsByDimension[dimension] ?? []).slice(0, gapsToFill));
  const candidates = await fetchCandidates(context, targets);
  // Esta busca roda a cada requisição porque depende das dispensas atuais.
  console.log(
    `[data] discover-picks UNCACHED ${Math.round(performance.now() - start)}ms (context ${contextMs}ms, ${targets.length} TMDB gap queries, degraded=${context.degraded})`,
  );

  return {
    totalFilms: context.films.length,
    focus: focus ?? "auto",
    picks: assemblePicks({ gapsByDimension: context.gapsByDimension, candidates, totalFilms: context.films.length }),
    degraded: context.degraded,
  };
}

// Seleção para a roleta

export type BlindSpotPoolEntry = CandidateMovie & {
  dimension: GapDimension;
  gapLabel: string;
  rationale: string;
};

/** Monta uma seleção ampla para a roleta e mantém o motivo de cada indicação. */
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

  // Embaralha para variar os giros com os mesmos pontos cegos.
  for (let i = entries.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [entries[i], entries[j]] = [entries[j], entries[i]];
  }
  return entries.slice(0, options.count);
}

/** Salva um desinteresse; `*` oculta a dimensão inteira. */
export async function dismissBlindSpot(userId: string, dimension: GapDimension, gapKey: string): Promise<void> {
  await prisma.blindSpotDismissal.upsert({
    where: { userId_dimension_gapKey: { userId, dimension, gapKey } },
    create: { userId, dimension, gapKey },
    update: {},
  });
}
