/** Calcula a evolução do gosto a partir do diário, sem acessar o Prisma. */

import { MIN_CROWD_VOTES, mean, normalizeCrowdRating, round } from "./palate.js";

/** Mínimo de sessões nos dois anos comparados. */
export const MIN_YEAR_SESSIONS = 3;
export const TOP_GENRES = 5;

export type TimelineEntry = {
  watchedAt: Date | null;
  loggedAt: Date | null;
  userRating: number | null;
  filmYear: number | null;
  /** Nota do TMDB entre 0 e 10. */
  crowdRating: number | null;
  crowdVotes: number | null;
  genres: string[];
};

export type GenreShare = {
  genre: string;
  count: number;
  /** Participação do gênero entre os filmes daquele ano. */
  share: number;
};

export type TimelineYear = {
  year: number;
  sessions: number;
  ratedCount: number;
  averageRating: number | null;
  /** Diferença média para o público na escala de 0 a 5. */
  tasteLean: number | null;
  leanSampleSize: number;
  averageFilmYear: number | null;
  genreShares: GenreShare[];
};

export type TimelineInsight = { year: number; sentences: string[] };

export type Timeline = {
  /** Anos em ordem crescente, apenas com registros datados. */
  years: TimelineYear[];
  topGenres: string[];
  insights: TimelineInsight[];
  sampleSize: number;
};

function entryDate(entry: TimelineEntry): Date | null {
  return entry.watchedAt ?? entry.loggedAt;
}

export function computeTimelineYears(entries: TimelineEntry[]): TimelineYear[] {
  const byYear = new Map<number, TimelineEntry[]>();
  for (const entry of entries) {
    const date = entryDate(entry);
    if (!date) continue;
    const year = date.getUTCFullYear();
    byYear.set(year, [...(byYear.get(year) ?? []), entry]);
  }

  return [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, group]) => {
      const rated = group.filter((entry) => entry.userRating != null);
      const leans = group
        .filter((entry) => entry.userRating != null && entry.crowdRating != null && (entry.crowdVotes ?? 0) >= MIN_CROWD_VOTES)
        .map((entry) => (entry.userRating as number) - normalizeCrowdRating(entry.crowdRating as number));
      const withFilmYear = group.filter((entry) => entry.filmYear != null);
      const withGenres = group.filter((entry) => entry.genres.length > 0);

      const genreCounts = new Map<string, number>();
      for (const entry of withGenres) {
        for (const genre of new Set(entry.genres)) {
          if (!genre) continue;
          genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
        }
      }
      const genreShares: GenreShare[] = [...genreCounts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([genre, count]) => ({ genre, count, share: round(count / withGenres.length, 3) }));

      return {
        year,
        sessions: group.length,
        ratedCount: rated.length,
        averageRating: rated.length ? round(mean(rated.map((entry) => entry.userRating as number))) : null,
        tasteLean: leans.length ? round(mean(leans)) : null,
        leanSampleSize: leans.length,
        averageFilmYear: withFilmYear.length ? round(mean(withFilmYear.map((entry) => entry.filmYear as number)), 1) : null,
        genreShares,
      };
    });
}

export function computeTopGenres(entries: TimelineEntry[], limit = TOP_GENRES): string[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (!entryDate(entry)) continue;
    for (const genre of new Set(entry.genres)) {
      if (!genre) continue;
      counts.set(genre, (counts.get(genre) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([genre]) => genre);
}

type InsightCandidate = { score: number; sentence: string };

export function computeInsights(years: TimelineYear[]): TimelineInsight[] {
  const insights: TimelineInsight[] = [];

  for (let index = 1; index < years.length; index += 1) {
    const prev = years[index - 1];
    const curr = years[index];
    if (prev.sessions < MIN_YEAR_SESSIONS || curr.sessions < MIN_YEAR_SESSIONS) continue;

    const candidates: InsightCandidate[] = [];

    if (prev.genreShares.length && curr.genreShares.length) {
      const prevShares = new Map(prev.genreShares.map((item) => [item.genre, item.share]));
      const currShares = new Map(curr.genreShares.map((item) => [item.genre, item.share]));
      let best: { genre: string; delta: number } | null = null;
      for (const genre of new Set([...prevShares.keys(), ...currShares.keys()])) {
        const delta = (currShares.get(genre) ?? 0) - (prevShares.get(genre) ?? 0);
        if (!best || Math.abs(delta) > Math.abs(best.delta)) best = { genre, delta };
      }
      if (best && Math.abs(best.delta) >= 0.08) {
        const from = Math.round((prevShares.get(best.genre) ?? 0) * 100);
        const to = Math.round((currShares.get(best.genre) ?? 0) * 100);
        candidates.push({
          score: Math.abs(best.delta) * 4,
          sentence: best.delta > 0
            ? `${best.genre} ganhou espaço nas suas sessões: de ${from}% para ${to}%.`
            : `${best.genre} perdeu espaço nas suas sessões: de ${from}% para ${to}%.`,
        });
      }
    }

    if (prev.averageFilmYear != null && curr.averageFilmYear != null) {
      const delta = curr.averageFilmYear - prev.averageFilmYear;
      if (Math.abs(delta) >= 5) {
        candidates.push({
          score: Math.abs(delta) / 12,
          sentence: delta < 0
            ? `Você mergulhou mais fundo no passado: a época média dos filmes recuou de ${Math.round(prev.averageFilmYear)} para ${Math.round(curr.averageFilmYear)}.`
            : `Seu repertório ficou mais contemporâneo: a época média dos filmes avançou de ${Math.round(prev.averageFilmYear)} para ${Math.round(curr.averageFilmYear)}.`,
        });
      }
    }

    if (prev.averageRating != null && curr.averageRating != null) {
      const delta = curr.averageRating - prev.averageRating;
      if (Math.abs(delta) >= 0.25) {
        candidates.push({
          score: Math.abs(delta) * 1.6,
          sentence: delta > 0
            ? `Notas mais generosas: sua média subiu de ${prev.averageRating.toFixed(1)}★ para ${curr.averageRating.toFixed(1)}★.`
            : `Olhar mais exigente: sua média caiu de ${prev.averageRating.toFixed(1)}★ para ${curr.averageRating.toFixed(1)}★.`,
        });
      }
    }

    if (prev.tasteLean != null && curr.tasteLean != null) {
      const delta = curr.tasteLean - prev.tasteLean;
      if (Math.abs(delta) >= 0.2) {
        const fmt = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(2)}★`;
        candidates.push({
          score: Math.abs(delta) * 1.4,
          sentence: delta > 0
            ? `Mais generoso que o público: sua distância do consenso foi de ${fmt(prev.tasteLean)} para ${fmt(curr.tasteLean)}.`
            : `Mais exigente que o público: sua distância do consenso foi de ${fmt(prev.tasteLean)} para ${fmt(curr.tasteLean)}.`,
        });
      }
    }

    if (candidates.length) {
      insights.push({
        year: curr.year,
        sentences: candidates.sort((a, b) => b.score - a.score).slice(0, 2).map((candidate) => candidate.sentence),
      });
    }
  }

  return insights;
}

export function computeTimeline(entries: TimelineEntry[]): Timeline {
  const years = computeTimelineYears(entries);
  return {
    years,
    topGenres: computeTopGenres(entries),
    insights: computeInsights(years),
    sampleSize: years.reduce((sum, year) => sum + year.sessions, 0),
  };
}
