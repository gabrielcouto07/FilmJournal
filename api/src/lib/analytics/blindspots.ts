/** Calcula lacunas do histórico e monta indicações sem acessar banco ou rede. */

export type GapDimension = "decade" | "country" | "language" | "genre";

export const DIMENSION_ORDER: GapDimension[] = ["decade", "country", "language", "genre"];

export const DIMENSION_LABELS: Record<GapDimension, string> = {
  decade: "Década",
  country: "País",
  language: "Idioma",
  genre: "Gênero",
};

/** Nomes usados nas frases que explicam cada indicação. */
const DIMENSION_NOUNS: Record<GapDimension, string> = {
  decade: "década",
  country: "país",
  language: "idioma",
  genre: "gênero",
};

/** Campos do filme usados no cálculo de cobertura. */
export type CoverageFilm = {
  year: number | null;
  countries: string[]; // ISO 3166-1
  originalLanguage: string | null; // ISO 639-1
  genreIds: number[]; // TMDB genre ids
};

/** Faixa de uma dimensão com um trecho pronto para montar a explicação. */
export type DomainBucket = { key: string; label: string; phrase: string };

/** Países em uma ordem útil para priorizar lacunas sem cobertura. */
export const COUNTRY_DOMAIN: DomainBucket[] = [
  { key: "US", label: "Estados Unidos", phrase: "dos Estados Unidos" },
  { key: "FR", label: "França", phrase: "da França" },
  { key: "JP", label: "Japão", phrase: "do Japão" },
  { key: "IT", label: "Itália", phrase: "da Itália" },
  { key: "GB", label: "Reino Unido", phrase: "do Reino Unido" },
  { key: "KR", label: "Coreia do Sul", phrase: "da Coreia do Sul" },
  { key: "DE", label: "Alemanha", phrase: "da Alemanha" },
  { key: "ES", label: "Espanha", phrase: "da Espanha" },
  { key: "IN", label: "Índia", phrase: "da Índia" },
  { key: "HK", label: "Hong Kong", phrase: "de Hong Kong" },
  { key: "SE", label: "Suécia", phrase: "da Suécia" },
  { key: "MX", label: "México", phrase: "do México" },
  { key: "BR", label: "Brasil", phrase: "do Brasil" },
  { key: "DK", label: "Dinamarca", phrase: "da Dinamarca" },
  { key: "IR", label: "Irã", phrase: "do Irã" },
  { key: "CN", label: "China", phrase: "da China" },
  { key: "TW", label: "Taiwan", phrase: "de Taiwan" },
  { key: "AR", label: "Argentina", phrase: "da Argentina" },
  { key: "PL", label: "Polônia", phrase: "da Polônia" },
  { key: "AU", label: "Austrália", phrase: "da Austrália" },
];

/** Principais idiomas no formato ISO usado pelo TMDB. */
export const LANGUAGE_DOMAIN: DomainBucket[] = [
  { key: "en", label: "Inglês", phrase: "em inglês" },
  { key: "fr", label: "Francês", phrase: "em francês" },
  { key: "ja", label: "Japonês", phrase: "em japonês" },
  { key: "it", label: "Italiano", phrase: "em italiano" },
  { key: "ko", label: "Coreano", phrase: "em coreano" },
  { key: "de", label: "Alemão", phrase: "em alemão" },
  { key: "es", label: "Espanhol", phrase: "em espanhol" },
  { key: "pt", label: "Português", phrase: "em português" },
  { key: "hi", label: "Hindi", phrase: "em hindi" },
  { key: "zh", label: "Mandarim", phrase: "em mandarim" },
  { key: "cn", label: "Cantonês", phrase: "em cantonês" },
  { key: "sv", label: "Sueco", phrase: "em sueco" },
  { key: "da", label: "Dinamarquês", phrase: "em dinamarquês" },
  { key: "fa", label: "Persa", phrase: "em persa" },
  { key: "ru", label: "Russo", phrase: "em russo" },
  { key: "pl", label: "Polonês", phrase: "em polonês" },
];

/** Décadas dos anos 1930 até a atual. */
export function decadeDomain(currentYear: number): DomainBucket[] {
  const latest = Math.floor(currentYear / 10) * 10;
  const buckets: DomainBucket[] = [];
  for (let decade = 1930; decade <= latest; decade += 10) {
    buckets.push({ key: String(decade), label: `${decade}s`, phrase: `dos anos ${decade}` });
  }
  return buckets;
}

/** Gêneros que não ajudam a apontar lacunas de gosto. */
const GENRE_STOPLIST = new Set([10770]);

/** Gêneros disponíveis na lista traduzida do TMDB. */
export function genreDomain(genres: Array<{ id: number; name: string }>): DomainBucket[] {
  return genres
    .filter((genre) => !GENRE_STOPLIST.has(genre.id))
    .map((genre) => ({ key: String(genre.id), label: genre.name, phrase: `de ${genre.name}` }));
}

// Cobertura

export type Coverage = Map<string, number>;

/** Conta os filmes do usuário em cada faixa de uma dimensão. */
export function computeCoverage(films: CoverageFilm[], dimension: GapDimension): Coverage {
  const coverage: Coverage = new Map();
  const add = (key: string | null | undefined) => {
    if (!key) return;
    coverage.set(key, (coverage.get(key) ?? 0) + 1);
  };

  for (const film of films) {
    if (dimension === "decade") {
      if (film.year != null) add(String(Math.floor(film.year / 10) * 10));
    } else if (dimension === "country") {
      for (const code of film.countries) add(code);
    } else if (dimension === "language") {
      add(film.originalLanguage);
    } else {
      for (const id of film.genreIds) add(String(id));
    }
  }
  return coverage;
}

// Lacunas

/** Limite para considerar uma faixa muito abaixo da média do usuário. */
export const GAP_RATIO = 0.25;
const MAX_GAPS_PER_DIMENSION = 6;

export type GapBucket = {
  dimension: GapDimension;
  key: string;
  label: string;
  phrase: string;
  /** Filmes do usuário nesta faixa. */
  count: number;
  /** Média do usuário nas faixas cobertas da dimensão. */
  averageBucketSize: number;
};

/** Chaves de dispensa seguem o formato `country:JP` ou `country:*`. */
export const dismissalKey = (dimension: GapDimension, gapKey: string) => `${dimension}:${gapKey}`;

/** Encontra lacunas, priorizando faixas vazias e depois as menos cobertas. */
export function findGaps(options: {
  dimension: GapDimension;
  domain: DomainBucket[];
  coverage: Coverage;
  dismissed?: Set<string>;
}): GapBucket[] {
  const { dimension, domain, coverage } = options;
  const dismissed = options.dismissed ?? new Set<string>();
  if (dismissed.has(dismissalKey(dimension, "*"))) return [];

  const covered = domain.map((bucket) => coverage.get(bucket.key) ?? 0).filter((count) => count > 0);
  const average = covered.length ? covered.reduce((sum, count) => sum + count, 0) / covered.length : 0;

  const toGap = (bucket: DomainBucket, count: number): GapBucket => ({
    dimension,
    key: bucket.key,
    label: bucket.label,
    phrase: bucket.phrase,
    count,
    averageBucketSize: Math.round(average * 10) / 10,
  });

  const zero: GapBucket[] = [];
  const thin: GapBucket[] = [];
  for (const bucket of domain) {
    if (dismissed.has(dismissalKey(dimension, bucket.key))) continue;
    const count = coverage.get(bucket.key) ?? 0;
    if (count === 0) zero.push(toGap(bucket, count));
    else if (count < average * GAP_RATIO) thin.push(toGap(bucket, count));
  }
  thin.sort((a, b) => a.count - b.count);

  return [...zero, ...thin].slice(0, MAX_GAPS_PER_DIMENSION);
}

// Indicações

/** Candidato do TMDB, geralmente ainda fora do catálogo local. */
export type CandidateMovie = {
  tmdbId: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string | null;
  rating: number | null; // TMDB vote_average, 0–10
  voteCount: number | null;
  genreIds: number[]; // lets the roulette apply its genre filter to blind-spot pools
};

export type BlindSpotPick = {
  movie: CandidateMovie;
  dimension: GapDimension;
  gapKey: string;
  gapLabel: string;
  /** Quantidade de filmes do usuário nesta faixa. */
  coverage: number;
  /** Explicação criada com os mesmos dados que apontaram a lacuna. */
  rationale: string;
};

/** Monta a justificativa com os números que geraram a lacuna. */
export function buildRationale(gap: GapBucket, totalFilms: number, movie: CandidateMovie): string {
  const yearPart = movie.year ? ` (${movie.year})` : "";
  const ratingPart = movie.rating != null ? `, nota ${movie.rating.toFixed(1)} no TMDB,` : "";
  if (gap.count === 0) {
    return `Você registrou ${totalFilms} filmes, mas nenhum ${gap.phrase}. ${movie.title}${yearPart}${ratingPart} é o filme mais aclamado que falta nessa lacuna.`;
  }
  return `Só ${gap.count} dos seus ${totalFilms} filmes são ${gap.phrase} — sua média é ${gap.averageBucketSize} por ${DIMENSION_NOUNS[gap.dimension]}. ${movie.title}${yearPart}${ratingPart} é o mais aclamado que você ainda não viu.`;
}

/** Alterna dimensões ao montar as indicações e evita repetir filmes. */
export function assemblePicks(options: {
  gapsByDimension: Partial<Record<GapDimension, GapBucket[]>>;
  /** Candidatos por lacuna, indexados pela chave de dispensa. */
  candidates: Map<string, CandidateMovie[]>;
  totalFilms: number;
  maxPicks?: number;
}): BlindSpotPick[] {
  const { gapsByDimension, candidates, totalFilms } = options;
  const maxPicks = options.maxPicks ?? 4;

  const queues = DIMENSION_ORDER
    .map((dimension) => ({ dimension, gaps: [...(gapsByDimension[dimension] ?? [])] }))
    .filter((queue) => queue.gaps.length > 0);

  const picks: BlindSpotPick[] = [];
  const usedMovies = new Set<number>();

  while (picks.length < maxPicks && queues.some((queue) => queue.gaps.length > 0)) {
    for (const queue of queues) {
      if (picks.length >= maxPicks) break;
      const gap = queue.gaps.shift();
      if (!gap) continue; // this queue is drained; others may still have gaps
      const pool = candidates.get(dismissalKey(gap.dimension, gap.key)) ?? [];
      const movie = pool.find((candidate) => !usedMovies.has(candidate.tmdbId));
      if (!movie) continue; // candidate-less gap consumed — its dimension retries with the next gap on the next lap
      usedMovies.add(movie.tmdbId);
      picks.push({
        movie,
        dimension: gap.dimension,
        gapKey: gap.key,
        gapLabel: gap.label,
        coverage: gap.count,
        rationale: buildRationale(gap, totalFilms, movie),
      });
    }
    // Cada volta remove ao menos uma lacuna, então o laço sempre termina.
  }

  return picks;
}
