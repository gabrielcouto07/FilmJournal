import assert from "node:assert/strict";
import test from "node:test";
import {
  actorsVisible,
  CAST_EXACT_MIN,
  computeHybridScore,
  dailyKey,
  dailySeed,
  gradeGuess,
  hintUnlocked,
  MAX_GUESSES,
  posterStage,
  revealOrder,
  type MovieProfile,
} from "../src/lib/play/hybrid";

function profile(overrides: Partial<MovieProfile> = {}): MovieProfile {
  return {
    tmdbId: 100,
    title: "Alvo",
    year: 2010,
    genres: [
      { id: 18, name: "Drama" },
      { id: 53, name: "Thriller" },
    ],
    directorId: 525,
    directorName: "Christopher Nolan",
    companies: [
      { id: 9996, name: "Syncopy" },
      { id: 174, name: "Warner Bros." },
    ],
    rating: 8.2,
    cast: [
      { id: 1, name: "Ator Um", profilePath: null },
      { id: 2, name: "Ator Dois", profilePath: null },
      { id: 3, name: "Ator Três", profilePath: null },
      { id: 4, name: "Ator Quatro", profilePath: null },
      { id: 5, name: "Ator Cinco", profilePath: null },
    ],
    ...overrides,
  };
}

// ------------------------------------------------------------------ grading

test("a guess of the target itself is correct and all-green", () => {
  const target = profile();
  const grade = gradeGuess(target, target);
  assert.equal(grade.correct, true);
  assert.equal(grade.tiles.year.grade, "exact");
  assert.equal(grade.tiles.genres.grade, "exact");
  assert.equal(grade.tiles.director.grade, "exact");
  assert.equal(grade.tiles.studio.grade, "exact");
  assert.equal(grade.tiles.rating.grade, "exact");
  assert.equal(grade.tiles.cast.grade, "exact");
});

test("year tile: exact, close within ±5 with arrow toward the target, miss beyond", () => {
  const target = profile({ year: 2010 });
  assert.equal(gradeGuess(profile({ tmdbId: 1, year: 2010 }), target).tiles.year.grade, "exact");

  const close = gradeGuess(profile({ tmdbId: 1, year: 2005 }), target).tiles.year;
  assert.equal(close.grade, "close");
  assert.equal(close.direction, "target-higher");

  const miss = gradeGuess(profile({ tmdbId: 1, year: 2020 }), target).tiles.year;
  assert.equal(miss.grade, "miss");
  assert.equal(miss.direction, "target-lower");

  assert.equal(gradeGuess(profile({ tmdbId: 1, year: null }), target).tiles.year.grade, "miss");
});

test("genre tile: identical sets exact, any overlap close with shared names, none miss", () => {
  const target = profile();
  const reordered = profile({
    tmdbId: 1,
    genres: [
      { id: 53, name: "Thriller" },
      { id: 18, name: "Drama" },
    ],
  });
  assert.equal(gradeGuess(reordered, target).tiles.genres.grade, "exact");

  const partial = gradeGuess(
    profile({ tmdbId: 1, genres: [{ id: 18, name: "Drama" }, { id: 35, name: "Comedy" }] }),
    target,
  ).tiles.genres;
  assert.equal(partial.grade, "close");
  assert.deepEqual(partial.shared, ["Drama"]);

  assert.equal(
    gradeGuess(profile({ tmdbId: 1, genres: [{ id: 35, name: "Comedy" }] }), target).tiles.genres.grade,
    "miss",
  );
  // Subset is close, not exact: same ids shared but different set sizes.
  assert.equal(
    gradeGuess(profile({ tmdbId: 1, genres: [{ id: 18, name: "Drama" }] }), target).tiles.genres.grade,
    "close",
  );
});

test("director tile: person id wins, name is the fallback, otherwise miss", () => {
  const target = profile();
  assert.equal(gradeGuess(profile({ tmdbId: 1 }), target).tiles.director.grade, "exact");
  assert.equal(
    gradeGuess(profile({ tmdbId: 1, directorId: 999 }), target).tiles.director.grade,
    "miss",
  );
  // Ids missing on one side → compare by normalized name.
  assert.equal(
    gradeGuess(
      profile({ tmdbId: 1, directorId: null, directorName: "  christopher nolan " }),
      target,
    ).tiles.director.grade,
    "exact",
  );
  assert.equal(
    gradeGuess(profile({ tmdbId: 1, directorId: null, directorName: null }), target).tiles.director.grade,
    "miss",
  );
});

test("studio tile: same primary exact, shared secondary close, none miss", () => {
  const target = profile();
  assert.equal(gradeGuess(profile({ tmdbId: 1 }), target).tiles.studio.grade, "exact");

  const shared = gradeGuess(
    profile({ tmdbId: 1, companies: [{ id: 4, name: "Paramount" }, { id: 174, name: "Warner Bros." }] }),
    target,
  ).tiles.studio;
  assert.equal(shared.grade, "close");
  assert.deepEqual(shared.shared, ["Warner Bros."]);

  assert.equal(
    gradeGuess(profile({ tmdbId: 1, companies: [{ id: 4, name: "Paramount" }] }), target).tiles.studio.grade,
    "miss",
  );
  assert.equal(gradeGuess(profile({ tmdbId: 1, companies: [] }), target).tiles.studio.grade, "miss");
});

test("rating tile: ±0.3 exact, ±1.0 close with direction, beyond miss", () => {
  const target = profile({ rating: 8.2 });
  assert.equal(gradeGuess(profile({ tmdbId: 1, rating: 8.0 }), target).tiles.rating.grade, "exact");

  const close = gradeGuess(profile({ tmdbId: 1, rating: 7.4 }), target).tiles.rating;
  assert.equal(close.grade, "close");
  assert.equal(close.direction, "target-higher");

  assert.equal(gradeGuess(profile({ tmdbId: 1, rating: 6.0 }), target).tiles.rating.grade, "miss");
  assert.equal(gradeGuess(profile({ tmdbId: 1, rating: null }), target).tiles.rating.grade, "miss");
});

test("cast tile: >=3 shared exact, 1-2 close with target names, 0 miss", () => {
  const target = profile();
  const threeShared = profile({
    tmdbId: 1,
    cast: [
      { id: 1, name: "Ator Um", profilePath: null },
      { id: 2, name: "Ator Dois", profilePath: null },
      { id: 3, name: "Ator Três", profilePath: null },
      { id: 99, name: "Outro", profilePath: null },
    ],
  });
  const exact = gradeGuess(threeShared, target).tiles.cast;
  assert.equal(exact.grade, "exact");
  assert.equal(exact.shared.length, CAST_EXACT_MIN);

  const oneShared = profile({ tmdbId: 1, cast: [{ id: 5, name: "Ator Cinco", profilePath: null }] });
  const close = gradeGuess(oneShared, target).tiles.cast;
  assert.equal(close.grade, "close");
  assert.deepEqual(close.shared, ["Ator Cinco"]);

  const none = profile({ tmdbId: 1, cast: [{ id: 77, name: "Ninguém", profilePath: null }] });
  assert.equal(gradeGuess(none, target).tiles.cast.grade, "miss");
});

// ---------------------------------------------------------- reveal schedule

test("actorsVisible follows the signed-off schedule and caps at the cast size", () => {
  const table: Array<[number, number]> = [
    [1, 1], [2, 2], [3, 3], [4, 4], [5, 4], [6, 5], [7, 5], [8, 5], [9, 5], [10, 5],
  ];
  for (const [guessNumber, expected] of table) {
    assert.equal(actorsVisible(guessNumber, 8), expected, `guess ${guessNumber}`);
  }
  // A three-actor movie never shows more than it has.
  assert.equal(actorsVisible(10, 3), 3);
  assert.equal(actorsVisible(2, 3), 2);
});

test("posterStage: hidden until 7, heavy 7, medium 8, light 9-10", () => {
  assert.equal(posterStage(1), "hidden");
  assert.equal(posterStage(6), "hidden");
  assert.equal(posterStage(7), "heavy");
  assert.equal(posterStage(8), "medium");
  assert.equal(posterStage(9), "light");
  assert.equal(posterStage(10), "light");
});

test("hints unlock at guesses 5 and 8", () => {
  assert.equal(hintUnlocked(1, 4), false);
  assert.equal(hintUnlocked(1, 5), true);
  assert.equal(hintUnlocked(2, 7), false);
  assert.equal(hintUnlocked(2, 8), true);
});

test("revealOrder flips the top-5 billing so clues escalate", () => {
  const order = revealOrder(["a", "b", "c", "d", "e", "f"]);
  assert.deepEqual(order, ["e", "d", "c", "b", "a"]);
  assert.deepEqual(revealOrder(["a", "b"]), ["b", "a"]);
});

// ------------------------------------------------------------------ scoring

test("computeHybridScore rewards fewer guesses and unused hints", () => {
  assert.equal(computeHybridScore({ solved: true, guessesUsed: 1, hintsUsed: 0 }), 1100);
  assert.equal(computeHybridScore({ solved: true, guessesUsed: 1, hintsUsed: 2 }), 1000);
  assert.equal(computeHybridScore({ solved: true, guessesUsed: 5, hintsUsed: 1 }), 650);
  assert.equal(computeHybridScore({ solved: true, guessesUsed: MAX_GUESSES, hintsUsed: 2 }), 100);
  assert.equal(computeHybridScore({ solved: false, guessesUsed: 10, hintsUsed: 2 }), 0);
  // Out-of-range inputs are clamped, never negative.
  assert.equal(computeHybridScore({ solved: true, guessesUsed: 99, hintsUsed: 99 }), 100);
});

// --------------------------------------------------------------- daily seed

test("dailySeed is deterministic per day key and varies across days", () => {
  const today = dailyKey(new Date("2026-07-22T15:30:00Z"));
  assert.equal(today, "2026-07-22");
  assert.equal(dailySeed(today), dailySeed("2026-07-22"));
  assert.notEqual(dailySeed("2026-07-22"), dailySeed("2026-07-23"));
  // Stays within uint32 so page/index derivation is safe.
  assert.ok(dailySeed("2026-07-22") >= 0 && dailySeed("2026-07-22") <= 0xffffffff);
});
