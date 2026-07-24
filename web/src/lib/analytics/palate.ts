/** Calcula o Paladar a partir de dados já carregados. */

/** Escala de notas do usuário. */
export const USER_SCALE_MAX = 5;
/** Escala usada pelo TMDB. */
export const CROWD_SCALE_MAX = 10;
/** Mínimo de votos para a nota do público ser confiável. */
export const MIN_CROWD_VOTES = 50;
/** Mínimo de filmes para indicar fidelidade a um diretor. */
export const DIRECTOR_LOYALTY_MIN = 3;

/** Filme avaliado no formato usado pelas análises. */
export type PalateFilm = {
  id: string;
  title: string;
  year: number | null;
  /** Nota do usuário entre 0 e 5. */
  userRating: number;
  /** Nota do TMDB entre 0 e 10. */
  crowdRating: number | null;
  /** Quantidade de votos no TMDB. */
  crowdVotes: number | null;
  runtime: number | null;
  /** Códigos ISO dos países. */
  countries: string[];
  /** Gêneros do TMDB. */
  genres: string[];
  directorId: number | null;
  directorName: string | null;
};

/** Converte a nota do público para a escala de 0 a 5. */
export function normalizeCrowdRating(crowd: number): number {
  return crowd * (USER_SCALE_MAX / CROWD_SCALE_MAX);
}

/** Média aritmética; retorna 0 para uma lista vazia. */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Arredonda para a quantidade de casas pedida. */
export function round(value: number, places = 2): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

// Comparação com o público

export type ContrarianPoint = {
  id: string;
  title: string;
  year: number | null;
  /** Nota do usuário. */
  userRating: number;
  /** Nota do público convertida para 0–5. */
  crowdRating: number;
  /** Diferença positiva quando o usuário gostou mais que o público. */
  delta: number;
};

export type Contrarian = {
  points: ContrarianPoint[];
  /** Distância média absoluta para a nota do público. */
  contrarianScore: number;
  /** Diferença média; positiva indica notas mais generosas. */
  tasteLean: number;
  /** Filmes avaliados bem acima do público. */
  loves: ContrarianPoint[];
  /** Filmes avaliados bem abaixo do público. */
  pans: ContrarianPoint[];
  sampleSize: number;
};

/** Compara as notas usando apenas filmes com votos suficientes no TMDB. */
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

// Décadas

export type DecadeBucket = { decade: number; label: string; count: number };

/** Conta filmes por década e ignora os que não têm ano. */
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

// Países

export type CountryCount = { code: string; count: number };

/** Conta filmes por país; coproduções entram uma vez em cada país. */
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

// Gêneros

export type GenreCount = { genre: string; count: number };

/** Conta filmes por gênero, do mais visto para o menos visto. */
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

// Duração

export type RuntimeBucket = {
  label: string;
  /** Limite mínimo em minutos. */
  min: number;
  /** Limite máximo; `null` deixa a última faixa aberta. */
  max: number | null;
  count: number;
  /** Marca a faixa mais comum. */
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

/** Agrupa por duração e destaca a faixa mais comum. */
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

// Diretores

export type DirectorLoyalty = {
  directorId: number | null;
  name: string;
  count: number;
  /** Nota média dos filmes deste diretor. */
  averageRating: number;
};

/** Lista os diretores recorrentes por quantidade e nota média. */
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

// Paladar completo

export type Palate = {
  totalFilms: number;
  contrarian: Contrarian;
  decades: DecadeBucket[];
  countries: CountryCount[];
  genres: GenreCount[];
  runtimes: RuntimeBucket[];
  directors: DirectorLoyalty[];
};

/** Calcula todas as partes do Paladar em uma chamada. */
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
