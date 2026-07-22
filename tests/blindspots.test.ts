import assert from "node:assert/strict";
import test from "node:test";
import {
  assemblePicks,
  buildRationale,
  computeCoverage,
  COUNTRY_DOMAIN,
  decadeDomain,
  dismissalKey,
  findGaps,
  genreDomain,
  type CandidateMovie,
  type CoverageFilm,
  type GapBucket,
} from "../src/lib/analytics/blindspots";

function film(overrides: Partial<CoverageFilm> = {}): CoverageFilm {
  return { year: 2015, countries: ["US"], originalLanguage: "en", genreIds: [18], ...overrides };
}

let movieCounter = 0;
function candidate(overrides: Partial<CandidateMovie> = {}): CandidateMovie {
  movieCounter += 1;
  return {
    tmdbId: 1000 + movieCounter,
    title: `Candidate ${movieCounter}`,
    year: 1965,
    posterPath: null,
    backdropPath: null,
    overview: null,
    rating: 8.2,
    voteCount: 900,
    genreIds: [],
    ...overrides,
  };
}

test("computeCoverage buckets films per dimension (co-productions count once per country)", () => {
  const films = [
    film({ year: 1994, countries: ["US", "GB"], originalLanguage: "en", genreIds: [18, 53] }),
    film({ year: 1999, countries: ["US"], originalLanguage: "en", genreIds: [18] }),
    film({ year: 2003, countries: ["JP"], originalLanguage: "ja", genreIds: [16] }),
    film({ year: null, countries: [], originalLanguage: null, genreIds: [] }),
  ];
  assert.deepEqual([...computeCoverage(films, "decade")], [["1990", 2], ["2000", 1]]);
  assert.deepEqual([...computeCoverage(films, "country")], [["US", 2], ["GB", 1], ["JP", 1]]);
  assert.deepEqual([...computeCoverage(films, "language")], [["en", 2], ["ja", 1]]);
  assert.deepEqual([...computeCoverage(films, "genre")], [["18", 2], ["53", 1], ["16", 1]]);
});

test("decadeDomain spans the 1930s through the current decade", () => {
  const domain = decadeDomain(2026);
  assert.equal(domain[0].key, "1930");
  assert.equal(domain[domain.length - 1].key, "2020");
  assert.equal(domain.find((bucket) => bucket.key === "1960")?.phrase, "dos anos 1960");
});

test("findGaps puts zero-coverage buckets first (domain order), then thinnest covered buckets", () => {
  // Todas as décadas têm dez filmes, menos 1960 (um) e 2020 (nenhum).
  const films = [1930, 1940, 1950, 1970, 1980, 1990, 2000, 2010].flatMap((decade) =>
    Array.from({ length: 10 }, () => film({ year: decade + 5 })),
  );
  films.push(film({ year: 1965 }));
  const gaps = findGaps({
    dimension: "decade",
    domain: decadeDomain(2026),
    coverage: computeCoverage(films, "decade"),
  });
  // A faixa vazia vem antes da década de 1960, que tem pouca cobertura.
  assert.deepEqual(gaps.map((gap) => gap.key), ["2020", "1960"]);
  assert.equal(gaps[0].count, 0);
  assert.equal(gaps[1].count, 1);
});

test("findGaps caps output and lets zero-coverage buckets outrank thin ones", () => {
  // O limite de seis é preenchido pelas décadas vazias na ordem do domínio.
  const films = [...Array.from({ length: 40 }, () => film({ year: 2015 })), film({ year: 2005 })];
  const gaps = findGaps({
    dimension: "decade",
    domain: decadeDomain(2026),
    coverage: computeCoverage(films, "decade"),
  });
  assert.equal(gaps.length, 6);
  assert.deepEqual(gaps.map((gap) => gap.key), ["1930", "1940", "1950", "1960", "1970", "1980"]);
  assert.ok(!gaps.some((gap) => gap.key === "2010"));
});

test("findGaps respects bucket dismissals and whole-dimension mutes", () => {
  const films = [film({ countries: ["US"] })];
  const coverage = computeCoverage(films, "country");
  const withoutFrance = findGaps({
    dimension: "country",
    domain: COUNTRY_DOMAIN,
    coverage,
    dismissed: new Set([dismissalKey("country", "FR")]),
  });
  assert.ok(!withoutFrance.some((gap) => gap.key === "FR"));

  const muted = findGaps({
    dimension: "country",
    domain: COUNTRY_DOMAIN,
    coverage,
    dismissed: new Set([dismissalKey("country", "*")]),
  });
  assert.deepEqual(muted, []);
});

test("assemblePicks takes one pick per dimension in auto mode and dedupes movies", () => {
  const shared = candidate({ tmdbId: 42, title: "Shared Classic" });
  const decadeGap: GapBucket = { dimension: "decade", key: "1960", label: "1960s", phrase: "dos anos 1960", count: 0, averageBucketSize: 10 };
  const countryGap: GapBucket = { dimension: "country", key: "FR", label: "França", phrase: "da França", count: 0, averageBucketSize: 8 };
  const fallback = candidate({ tmdbId: 43, title: "French Fallback" });

  const picks = assemblePicks({
    gapsByDimension: { decade: [decadeGap], country: [countryGap] },
    candidates: new Map([
      [dismissalKey("decade", "1960"), [shared]],
      [dismissalKey("country", "FR"), [shared, fallback]], // shared is taken by the decade pick
    ]),
    totalFilms: 100,
  });

  assert.equal(picks.length, 2);
  assert.deepEqual(picks.map((pick) => pick.dimension), ["decade", "country"]);
  assert.equal(picks[0].movie.tmdbId, 42);
  assert.equal(picks[1].movie.tmdbId, 43); // deduped across picks
});

test("assemblePicks in single-dimension focus yields several gaps of that dimension", () => {
  const gaps: GapBucket[] = ["1930", "1940", "1950", "1960", "1970"].map((key) => ({
    dimension: "decade", key, label: `${key}s`, phrase: `dos anos ${key}`, count: 0, averageBucketSize: 12,
  }));
  const candidates = new Map(gaps.map((gap) => [dismissalKey("decade", gap.key), [candidate()]]));
  const picks = assemblePicks({ gapsByDimension: { decade: gaps }, candidates, totalFilms: 50 });
  assert.equal(picks.length, 4); // maxPicks default
  assert.ok(picks.every((pick) => pick.dimension === "decade"));
  assert.deepEqual(picks.map((pick) => pick.gapKey), ["1930", "1940", "1950", "1960"]);
});

test("assemblePicks skips a candidate-less gap and advances to the dimension's next gap", () => {
  const gaps: GapBucket[] = [
    { dimension: "genre", key: "99", label: "Documentário", phrase: "de Documentário", count: 0, averageBucketSize: 20 },
    { dimension: "genre", key: "37", label: "Faroeste", phrase: "de Faroeste", count: 0, averageBucketSize: 20 },
  ];
  const western = candidate({ title: "Western Pick" });
  const picks = assemblePicks({
    gapsByDimension: { genre: gaps },
    candidates: new Map([[dismissalKey("genre", "37"), [western]]]), // documentary pool is empty
    totalFilms: 80,
  });
  assert.equal(picks.length, 1);
  assert.equal(picks[0].gapKey, "37");
});

test("buildRationale derives both templates from the gap's own numbers", () => {
  const movie = candidate({ title: "Le Samouraï", year: 1967, rating: 8.0 });
  const zeroGap: GapBucket = { dimension: "decade", key: "1960", label: "1960s", phrase: "dos anos 1960", count: 0, averageBucketSize: 11.8 };
  const zero = buildRationale(zeroGap, 47, movie);
  assert.ok(zero.includes("47 filmes"), zero);
  assert.ok(zero.includes("nenhum dos anos 1960"), zero);
  assert.ok(zero.includes("Le Samouraï (1967)"), zero);

  const thinGap: GapBucket = { dimension: "country", key: "JP", label: "Japão", phrase: "do Japão", count: 2, averageBucketSize: 14.5 };
  const thin = buildRationale(thinGap, 200, movie);
  assert.ok(thin.includes("Só 2 dos seus 200 filmes"), thin);
  assert.ok(thin.includes("14.5 por país"), thin);
});

test("genreDomain builds buckets from the localized TMDB genre list", () => {
  const domain = genreDomain([{ id: 99, name: "Documentário" }, { id: 37, name: "Faroeste" }]);
  assert.deepEqual(domain[0], { key: "99", label: "Documentário", phrase: "de Documentário" });
});
