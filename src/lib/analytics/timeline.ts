/**
 * Taste-over-time analytics — pure, Prisma-free aggregation over the viewer's
 * diary (the LogEntry time series joined to films). The Prisma read lives in
 * the data layer (`getTimelineData` in src/lib/data.ts); this module only takes
 * plain data and returns plain data, so it is unit-testable without a database.
 *
 * Time axis: watchedAt, falling back to loggedAt when the watch day is unknown
 * (mirrors getStatsData). Entries with neither date are ignored.
 */

import { MIN_CROWD_VOTES, mean, normalizeCrowdRating, round } from "./palate";

/** Insights need at least this many sessions in BOTH compared years. */
export const MIN_YEAR_SESSIONS = 3;
/** How many genre series the drift chart follows. */
export const TOP_GENRES = 5;

/** One diary event, already flattened from Prisma into analytics-ready fields. */
export type TimelineEntry = {
  watchedAt: Date | null;
  loggedAt: Date | null;
  /** Viewer rating on the 0–5 scale, or null when unrated. */
  userRating: number | null;
  /** Film release year, or null when unknown. */
  filmYear: number | null;
  /** TMDB vote_average on the raw 0–10 scale, or null when unknown. */
  crowdRating: number | null;
  /** TMDB vote_count, used to gate low-confidence crowd ratings. */
  crowdVotes: number | null;
  /** TMDB genre names (relational genreList). */
  genres: string[];
};

export type GenreShare = {
  genre: string;
  count: number;
  /** Films tagged with the genre / films with at least one genre that year. */
  share: number;
};

export type TimelineYear = {
  year: number;
  sessions: number;
  ratedCount: number;
  /** Mean viewer rating that year, or null when nothing was rated. */
  averageRating: number | null;
  /** Mean signed user-vs-crowd gap on the 0–5 scale, or null without crowd data. */
  tasteLean: number | null;
  leanSampleSize: number;
  /** Mean release year of the films watched, or null when years are unknown. */
  averageFilmYear: number | null;
  /** Genre share this year, most-watched first. */
  genreShares: GenreShare[];
};

export type TimelineInsight = { year: number; sentences: string[] };

export type Timeline = {
  /** Ascending by watch year. Only years with at least one dated entry appear. */
  years: TimelineYear[];
  /** Top genres across the whole diary — the drift chart's series keys. */
  topGenres: string[];
  /** Auto-generated pt-BR observations, one entry per year with a notable shift. */
  insights: TimelineInsight[];
  /** Total dated diary events. */
  sampleSize: number;
};

function entryDate(entry: TimelineEntry): Date | null {
  return entry.watchedAt ?? entry.loggedAt;
}

/** Group entries by watch year and aggregate each year's taste signals. */
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

/** Top genres across all dated entries (a film counts once per genre). */
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

/**
 * Data-driven pt-BR observations: for each year, compare against the previous
 * year with data and describe the 1–2 largest shifts (genre share, film era,
 * rating generosity, distance from the crowd). Sparse years (fewer than
 * MIN_YEAR_SESSIONS sessions on either side) produce no insight.
 */
export function computeInsights(years: TimelineYear[]): TimelineInsight[] {
  const insights: TimelineInsight[] = [];

  for (let index = 1; index < years.length; index += 1) {
    const prev = years[index - 1];
    const curr = years[index];
    if (prev.sessions < MIN_YEAR_SESSIONS || curr.sessions < MIN_YEAR_SESSIONS) continue;

    const candidates: InsightCandidate[] = [];

    // Genre share drift — the genre whose share moved the most.
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

    // Era drift — how old the films you watch are.
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

    // Rating generosity trend.
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

    // Distance-from-the-crowd trend.
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

/** Compute the whole taste-over-time view in one call. */
export function computeTimeline(entries: TimelineEntry[]): Timeline {
  const years = computeTimelineYears(entries);
  return {
    years,
    topGenres: computeTopGenres(entries),
    insights: computeInsights(years),
    sampleSize: years.reduce((sum, year) => sum + year.sessions, 0),
  };
}
