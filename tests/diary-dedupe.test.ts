import assert from "node:assert/strict";
import test from "node:test";
import { createDiaryDedupeKey, createFilmIdentity, isAuthoritativeWatch, normalizeTitle } from "../src/lib/diary-dedupe";

test("normalizeTitle strips accents, punctuation and case", () => {
  assert.equal(normalizeTitle("Cidade de Deus!"), "cidade de deus");
  assert.equal(normalizeTitle("  Amélie "), "amelie");
});

test("createFilmIdentity builds a stable identity from title + year", () => {
  assert.equal(createFilmIdentity("Arrival", 2016), "arrival:2016");
  assert.equal(createFilmIdentity("Arrival", null), "arrival:unknown");
});

test("createDiaryDedupeKey separates same-day occurrences by ordinal", () => {
  const base = { movieId: "m1", watchedAt: new Date("2026-01-01T12:00:00Z") };
  assert.notEqual(
    createDiaryDedupeKey({ ...base, occurrence: 1 }),
    createDiaryDedupeKey({ ...base, occurrence: 2 }),
  );
});

test("createDiaryDedupeKey falls back to loggedAt, then 'undated'", () => {
  assert.match(createDiaryDedupeKey({ movieId: "m1", loggedAt: new Date("2026-02-03T12:00:00Z") }), /2026-02-03/);
  assert.match(createDiaryDedupeKey({ movieId: "m1" }), /undated/);
});

test("user-namespaced movie ids keep two users' dedupe keys distinct", () => {
  const watchedAt = new Date("2026-01-01T12:00:00Z");
  assert.notEqual(
    createDiaryDedupeKey({ movieId: "userA:m1", watchedAt }),
    createDiaryDedupeKey({ movieId: "userB:m1", watchedAt }),
  );
});

test("isAuthoritativeWatch accepts diary/review/manual and rejects catalog rows", () => {
  assert.equal(isAuthoritativeWatch("diary"), true);
  assert.equal(isAuthoritativeWatch("review,diary"), true);
  assert.equal(isAuthoritativeWatch("manual"), true);
  assert.equal(isAuthoritativeWatch("watched"), false);
});
