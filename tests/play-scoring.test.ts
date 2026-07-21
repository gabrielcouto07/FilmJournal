import assert from "node:assert/strict";
import test from "node:test";
import { computeRoundScore, isCorrectGuess, normalizeGuess, ROUND_MS } from "../src/lib/play/scoring";

test("normalizeGuess folds case, accents, punctuation and leading articles", () => {
  assert.equal(normalizeGuess("  The Godfather!  "), "godfather");
  assert.equal(normalizeGuess("O Poderoso Chefão"), "poderoso chefao");
  assert.equal(normalizeGuess("Amélie"), "amelie");
  assert.equal(normalizeGuess("La La Land"), "la land"); // only ONE leading article drops
  assert.equal(normalizeGuess("A"), "a"); // a lone article is kept, not emptied
});

test("isCorrectGuess accepts exact and article/punctuation variants", () => {
  assert.ok(isCorrectGuess("the godfather", ["The Godfather"]));
  assert.ok(isCorrectGuess("Godfather", ["The Godfather"]));
  assert.ok(isCorrectGuess("poderoso chefao", ["O Poderoso Chefão"]));
  assert.ok(!isCorrectGuess("The Godmother", ["The Godfather"])); // distance 4 — rejected
});

test("isCorrectGuess accepts the original title and subtitle-less form", () => {
  assert.ok(isCorrectGuess("Cidade de Deus", ["City of God", "Cidade de Deus"]));
  assert.ok(isCorrectGuess("Blade Runner", ["Blade Runner 2049"]) === false); // different film, not a subtitle split
  assert.ok(isCorrectGuess("Duna", ["Duna: Parte Dois"])); // subtitle after ":" may be omitted
});

test("isCorrectGuess tolerates small typos on longer titles only", () => {
  assert.ok(isCorrectGuess("Interstelar", ["Interstellar"])); // distance 1
  assert.ok(isCorrectGuess("Oppenheimr", ["Oppenheimer"])); // distance 1
  assert.ok(!isCorrectGuess("Up!", ["It"])); // short titles must match exactly
  assert.ok(!isCorrectGuess("", ["Anything"]));
});

test("computeRoundScore rewards fewer reveals and faster answers", () => {
  const fastOneReveal = computeRoundScore({ solved: true, revealedCount: 1, elapsedMs: 0 });
  const slowOneReveal = computeRoundScore({ solved: true, revealedCount: 1, elapsedMs: ROUND_MS });
  const fastFiveReveals = computeRoundScore({ solved: true, revealedCount: 5, elapsedMs: 0 });
  assert.equal(fastOneReveal, 1200); // 1000 base + full 200 time bonus
  assert.equal(slowOneReveal, 1000); // bonus fully decayed
  assert.equal(fastFiveReveals, 600); // 400 base + 200 bonus
  assert.ok(fastOneReveal > fastFiveReveals);
  assert.equal(computeRoundScore({ solved: false, revealedCount: 1, elapsedMs: 0 }), 0);
});

test("computeRoundScore clamps reveal count into 1..5", () => {
  assert.equal(
    computeRoundScore({ solved: true, revealedCount: 99, elapsedMs: ROUND_MS }),
    computeRoundScore({ solved: true, revealedCount: 5, elapsedMs: ROUND_MS }),
  );
});

test("round tokens seal and open with expiry (uses NEXTAUTH_SECRET)", async () => {
  process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || "test-secret-for-play-tokens";
  const { sealRound, openRound } = await import("../src/lib/play/token");
  const payload = {
    tmdbId: 550, title: "Fight Club", originalTitle: "Fight Club", year: 1999,
    posterPath: "/abc.jpg", cast: ["Edward Norton", "Brad Pitt"], source: "popular" as const,
    exp: Date.now() + 60_000,
  };
  const token = sealRound(payload);
  assert.ok(!token.includes("Fight"), "the answer must not be readable in the token");
  assert.deepEqual(openRound(token), payload);
  assert.equal(openRound(token.slice(0, -4) + "AAAA"), null); // tampered
  assert.equal(openRound(sealRound({ ...payload, exp: Date.now() - 1000 })), null); // expired
});
