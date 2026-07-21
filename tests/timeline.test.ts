import assert from "node:assert/strict";
import test from "node:test";
import {
  computeInsights,
  computeTimeline,
  computeTimelineYears,
  computeTopGenres,
  MIN_YEAR_SESSIONS,
  type TimelineEntry,
  type TimelineYear,
} from "../src/lib/analytics/timeline";

function entry(overrides: Partial<TimelineEntry> = {}): TimelineEntry {
  return {
    watchedAt: new Date("2024-06-15T12:00:00Z"),
    loggedAt: null,
    userRating: 3,
    filmYear: 2000,
    crowdRating: 6,
    crowdVotes: 500,
    genres: [],
    ...overrides,
  };
}

function year(overrides: Partial<TimelineYear> = {}): TimelineYear {
  return {
    year: 2024,
    sessions: 10,
    ratedCount: 10,
    averageRating: 3,
    tasteLean: 0,
    leanSampleSize: 10,
    averageFilmYear: 2000,
    genreShares: [],
    ...overrides,
  };
}

test("computeTimelineYears groups by watch year, falling back to loggedAt", () => {
  const entries = [
    entry({ watchedAt: new Date("2023-01-05T12:00:00Z") }),
    entry({ watchedAt: null, loggedAt: new Date("2023-11-20T12:00:00Z") }),
    entry({ watchedAt: new Date("2024-03-01T12:00:00Z") }),
    entry({ watchedAt: null, loggedAt: null }), // undated: ignored
  ];
  const years = computeTimelineYears(entries);
  assert.deepEqual(years.map((item) => [item.year, item.sessions]), [[2023, 2], [2024, 1]]);
});

test("computeTimelineYears aggregates rating, lean, film era and genre share", () => {
  const entries = [
    entry({ userRating: 5, crowdRating: 6, crowdVotes: 100, filmYear: 1990, genres: ["Drama", "Crime"] }), // lean 5-3 = +2
    entry({ userRating: 2, crowdRating: 8, crowdVotes: 100, filmYear: 2010, genres: ["Drama"] }), // lean 2-4 = -2
    entry({ userRating: null, crowdRating: 9, crowdVotes: 900, filmYear: null, genres: [] }), // unrated, yearless, genreless
    entry({ userRating: 4, crowdRating: 9, crowdVotes: 10, filmYear: 2000, genres: ["Comédia"] }), // < 50 votes: no lean
  ];
  const [result] = computeTimelineYears(entries);

  assert.equal(result.sessions, 4);
  assert.equal(result.ratedCount, 3);
  assert.equal(result.averageRating, 3.67); // mean(5, 2, 4)
  assert.equal(result.tasteLean, 0); // mean(+2, -2)
  assert.equal(result.leanSampleSize, 2);
  assert.equal(result.averageFilmYear, 2000); // mean(1990, 2010, 2000)
  // 3 films have genres; Drama in 2 of them.
  assert.deepEqual(result.genreShares[0], { genre: "Drama", count: 2, share: 0.667 });
});

test("computeTopGenres ranks genres across dated entries only", () => {
  const entries = [
    entry({ genres: ["Drama", "Crime"] }),
    entry({ genres: ["Drama"] }),
    entry({ genres: ["Comédia"] }),
    entry({ watchedAt: null, loggedAt: null, genres: ["Terror", "Terror"] }), // undated: ignored
  ];
  assert.deepEqual(computeTopGenres(entries, 2), ["Drama", "Comédia"]);
});

test("computeInsights describes the largest genre share shift", () => {
  const years = [
    year({ year: 2023, genreShares: [{ genre: "Drama", count: 5, share: 0.5 }, { genre: "Terror", count: 1, share: 0.1 }] }),
    year({ year: 2024, genreShares: [{ genre: "Drama", count: 2, share: 0.2 }, { genre: "Terror", count: 4, share: 0.4 }] }),
  ];
  const insights = computeInsights(years);
  assert.equal(insights.length, 1);
  assert.equal(insights[0].year, 2024);
  // Drama fell 30 points, Terror rose 30 — the tie keeps the first found; both are valid headline shifts.
  assert.match(insights[0].sentences[0], /(Drama perdeu espaço|Terror ganhou espaço)/);
  assert.match(insights[0].sentences[0], /de (50|10)% para (20|40)%/);
});

test("computeInsights reports era, rating and lean shifts with pt-BR templates", () => {
  const years = [
    year({ year: 2023, averageFilmYear: 2005, averageRating: 3.2, tasteLean: 0.1 }),
    year({ year: 2024, averageFilmYear: 1985, averageRating: 3.9, tasteLean: -0.4 }),
  ];
  const [insight] = computeInsights(years);
  // Era shift (20 years) outranks the rating shift (0.7★): both surface, era first.
  assert.equal(insight.sentences.length, 2);
  assert.match(insight.sentences[0], /mergulhou mais fundo no passado.*2005 para 1985/);
  assert.match(insight.sentences[1], /Notas mais generosas.*3\.2★ para 3\.9★/);
});

test("computeInsights skips sparse years and stays quiet on stable taste", () => {
  const sparse = [
    year({ year: 2023, sessions: MIN_YEAR_SESSIONS - 1 }),
    year({ year: 2024, averageRating: 5, averageFilmYear: 1950 }),
  ];
  assert.deepEqual(computeInsights(sparse), []);

  const stable = [
    year({ year: 2023 }),
    year({ year: 2024 }), // identical signals: no candidate clears a threshold
  ];
  assert.deepEqual(computeInsights(stable), []);
});

test("computeInsights tolerates missing crowd/relational data", () => {
  const years = [
    year({ year: 2023, tasteLean: null, averageFilmYear: null, genreShares: [] }),
    year({ year: 2024, tasteLean: null, averageFilmYear: null, genreShares: [], averageRating: 4.5 }),
  ];
  const insights = computeInsights(years);
  assert.equal(insights.length, 1);
  assert.match(insights[0].sentences[0], /Notas mais generosas/);
});

test("computeTimeline handles a one-year diary and an empty diary gracefully", () => {
  const single = computeTimeline([entry(), entry({ userRating: null })]);
  assert.equal(single.years.length, 1);
  assert.deepEqual(single.insights, []);
  assert.equal(single.sampleSize, 2);

  const empty = computeTimeline([]);
  assert.deepEqual(empty.years, []);
  assert.deepEqual(empty.topGenres, []);
  assert.deepEqual(empty.insights, []);
  assert.equal(empty.sampleSize, 0);
});
