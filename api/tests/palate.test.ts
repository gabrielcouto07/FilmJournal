import assert from "node:assert/strict";
import test from "node:test";
import {
  computeContrarian,
  computeCountries,
  computeDecades,
  computeDirectorLoyalty,
  computeGenres,
  computePalate,
  computeRuntimes,
  normalizeCrowdRating,
  type PalateFilm,
} from "../src/lib/analytics/palate.js";

let counter = 0;
function film(overrides: Partial<PalateFilm> = {}): PalateFilm {
  counter += 1;
  return {
    id: `f${counter}`,
    title: `Film ${counter}`,
    year: 2000,
    userRating: 3,
    crowdRating: 6,
    crowdVotes: 500,
    runtime: 100,
    countries: [],
    genres: [],
    directorId: null,
    directorName: null,
    ...overrides,
  };
}

test("normalizeCrowdRating maps the 0–10 crowd scale onto 0–5", () => {
  assert.equal(normalizeCrowdRating(10), 5);
  assert.equal(normalizeCrowdRating(7), 3.5);
  assert.equal(normalizeCrowdRating(0), 0);
});

test("computeContrarian gates on vote count and computes score, lean, loves, pans", () => {
  const films = [
    film({ id: "love", userRating: 5, crowdRating: 6, crowdVotes: 100 }), // crowd 3.0, delta +2
    film({ id: "pan", userRating: 1, crowdRating: 8, crowdVotes: 100 }), // crowd 4.0, delta -3
    film({ id: "agree", userRating: 3, crowdRating: 6, crowdVotes: 100 }), // crowd 3.0, delta 0
    film({ id: "lowvotes", userRating: 5, crowdRating: 9, crowdVotes: 10 }), // excluded: < 50 votes
    film({ id: "nocrowd", userRating: 4, crowdRating: null, crowdVotes: null }), // excluded: no crowd
  ];
  const result = computeContrarian(films);

  assert.equal(result.sampleSize, 3);
  assert.equal(result.contrarianScore, 1.67); // mean(|2|,|3|,|0|) = 5/3
  assert.equal(result.tasteLean, -0.33); // mean(2,-3,0) = -1/3
  assert.deepEqual(result.loves.map((point) => point.id), ["love"]);
  assert.deepEqual(result.pans.map((point) => point.id), ["pan"]);
  assert.equal(result.loves[0].crowdRating, 3);
  assert.equal(result.loves[0].delta, 2);
});

test("computeContrarian orders loves most-contrarian first and honours listSize", () => {
  const films = [
    film({ id: "a", userRating: 5, crowdRating: 8 }), // +1
    film({ id: "b", userRating: 5, crowdRating: 4 }), // +3
    film({ id: "c", userRating: 4.5, crowdRating: 5 }), // +2
  ];
  const result = computeContrarian(films, 2);
  assert.deepEqual(result.loves.map((point) => point.id), ["b", "c"]);
});

test("computeDecades buckets by decade ascending and ignores yearless films", () => {
  const films = [
    film({ year: 1995 }),
    film({ year: 1999 }),
    film({ year: 2001 }),
    film({ year: 2010 }),
    film({ year: null }),
  ];
  assert.deepEqual(computeDecades(films), [
    { decade: 1990, label: "1990s", count: 2 },
    { decade: 2000, label: "2000s", count: 1 },
    { decade: 2010, label: "2010s", count: 1 },
  ]);
});

test("computeCountries counts co-productions once per country, ranked", () => {
  const films = [
    film({ countries: ["US", "GB"] }),
    film({ countries: ["US"] }),
    film({ countries: ["JP"] }),
  ];
  assert.deepEqual(computeCountries(films), [
    { code: "US", count: 2 },
    { code: "GB", count: 1 },
    { code: "JP", count: 1 },
  ]);
  assert.deepEqual(computeCountries(films, 1), [{ code: "US", count: 2 }]);
});

test("computeGenres ranks by frequency then name", () => {
  const films = [
    film({ genres: ["Drama", "Thriller"] }),
    film({ genres: ["Drama"] }),
    film({ genres: ["Comedy"] }),
  ];
  assert.deepEqual(computeGenres(films), [
    { genre: "Drama", count: 2 },
    { genre: "Comedy", count: 1 },
    { genre: "Thriller", count: 1 },
  ]);
});

test("computeRuntimes flags the modal bucket as the sweet spot", () => {
  const films = [
    film({ runtime: 85 }), // < 90
    film({ runtime: 95 }), // 90–104
    film({ runtime: 100 }), // 90–104
    film({ runtime: 125 }), // 120–134
    film({ runtime: 200 }), // 150+
    film({ runtime: null }), // ignored
  ];
  const buckets = computeRuntimes(films);
  const sweet = buckets.filter((bucket) => bucket.sweetSpot);
  assert.equal(sweet.length, 1);
  assert.equal(sweet[0].label, "90–104");
  assert.equal(sweet[0].count, 2);
  assert.equal(buckets.find((bucket) => bucket.label === "150+")?.count, 1);
});

test("computeDirectorLoyalty requires 3+ films and averages ratings", () => {
  const films = [
    film({ directorId: 1, directorName: "Denis Villeneuve", userRating: 5 }),
    film({ directorId: 1, directorName: "Denis Villeneuve", userRating: 4 }),
    film({ directorId: 1, directorName: "Denis Villeneuve", userRating: 3 }),
    film({ directorId: 2, directorName: "Someone Else", userRating: 5 }),
    film({ directorId: 2, directorName: "Someone Else", userRating: 5 }),
    film({ directorId: null, directorName: null, userRating: 4 }),
  ];
  const loyalty = computeDirectorLoyalty(films);
  assert.equal(loyalty.length, 1);
  assert.equal(loyalty[0].name, "Denis Villeneuve");
  assert.equal(loyalty[0].count, 3);
  assert.equal(loyalty[0].averageRating, 4);
});

test("computeDirectorLoyalty ranks by film count then average rating", () => {
  const films = [
    film({ directorId: 1, directorName: "A", userRating: 3 }),
    film({ directorId: 1, directorName: "A", userRating: 3 }),
    film({ directorId: 1, directorName: "A", userRating: 3 }),
    film({ directorId: 2, directorName: "B", userRating: 5 }),
    film({ directorId: 2, directorName: "B", userRating: 5 }),
    film({ directorId: 2, directorName: "B", userRating: 5 }),
    film({ directorId: 2, directorName: "B", userRating: 5 }),
  ];
  const loyalty = computeDirectorLoyalty(films);
  assert.deepEqual(loyalty.map((entry) => entry.name), ["B", "A"]); // B has more films
});

test("computePalate assembles every aggregate", () => {
  const films = [
    film({ year: 1975, countries: ["US"], genres: ["Drama"], runtime: 120, directorId: 7, directorName: "Auteur", userRating: 5, crowdRating: 6, crowdVotes: 80 }),
    film({ year: 1978, countries: ["FR"], genres: ["Drama"], runtime: 95, directorId: 7, directorName: "Auteur", userRating: 4, crowdRating: 7, crowdVotes: 80 }),
    film({ year: 2015, countries: ["JP"], genres: ["Animation"], runtime: 88, directorId: 7, directorName: "Auteur", userRating: 4.5, crowdRating: 8, crowdVotes: 80 }),
  ];
  const palate = computePalate(films);
  assert.equal(palate.totalFilms, 3);
  assert.equal(palate.contrarian.sampleSize, 3);
  assert.equal(palate.decades.length, 2); // 1975 + 1978 share the 1970s
  assert.equal(palate.directors[0]?.count, 3);
  assert.ok(palate.runtimes.some((bucket) => bucket.sweetSpot));
});
