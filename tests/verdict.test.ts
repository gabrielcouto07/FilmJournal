import assert from "node:assert/strict";
import test from "node:test";
import {
  computeVerdict,
  genreLabel,
  MIN_LEAN_SAMPLE,
  MIN_RATED_FOR_VERDICT,
  type VerdictInput,
} from "../src/lib/analytics/verdict";

/** Entrada com todos os sinais: notas rígidas, drama dos anos 2000 e um diretor recorrente. */
function richInput(overrides: Partial<VerdictInput> = {}): VerdictInput {
  return {
    totalFilms: 40,
    contrarian: { tasteLean: -0.24, contrarianScore: 0.6, sampleSize: 35 },
    decades: [
      { decade: 1990, label: "1990s", count: 8 },
      { decade: 2000, label: "2000s", count: 15 },
      { decade: 2010, label: "2010s", count: 10 },
    ],
    genres: [
      { genre: "Drama", count: 18 },
      { genre: "Thriller", count: 9 },
    ],
    directors: [
      { directorId: 138, name: "Quentin Tarantino", count: 6, averageRating: 4.4 },
      { directorId: 525, name: "Christopher Nolan", count: 4, averageRating: 4.1 },
    ],
    ...overrides,
  };
}

test("genreLabel translates TMDB genres to pt-BR and falls back lowercased", () => {
  assert.equal(genreLabel("Science Fiction"), "ficção científica");
  assert.equal(genreLabel("Drama"), "drama");
  assert.equal(genreLabel("Mockumentary"), "mockumentary");
});

test("thin verdict below the rated-films floor", () => {
  const verdict = computeVerdict(richInput({ totalFilms: MIN_RATED_FOR_VERDICT - 1 }));
  assert.equal(verdict.thin, true);
  assert.equal(verdict.sentence, null);
  assert.equal(verdict.headline, null);
});

test("thin verdict when no signal passes its gate", () => {
  const verdict = computeVerdict({
    totalFilms: 12,
    contrarian: { tasteLean: -0.4, contrarianScore: 0.5, sampleSize: MIN_LEAN_SAMPLE - 1 },
    decades: [{ decade: 2010, label: "2010s", count: 2 }],
    genres: [{ genre: "Drama", count: 2 }],
    directors: [],
  });
  assert.equal(verdict.thin, true);
  assert.equal(verdict.sentence, null);
});

test("crítico voice: strict rater with every signal", () => {
  const verdict = computeVerdict(richInput(), "critico");
  assert.equal(verdict.thin, false);
  assert.equal(verdict.headline, "Paladar exigente.");
  assert.equal(
    verdict.sentence,
    "Você encara o consenso de frente — você avalia 0.24★ abaixo do público, na média — com raízes fincadas nos anos 2000, apetite por drama e retornos constantes a Quentin Tarantino (6 filmes).",
  );
});

test("retrato voice: strict rater with every signal", () => {
  const verdict = computeVerdict(richInput(), "retrato");
  assert.equal(verdict.headline, "Paladar exigente.");
  assert.equal(
    verdict.sentence,
    "Seu gosto mora nos anos 2000, vive de drama e volta sempre a Quentin Tarantino. Diante do público, você não faz média: 0.24★ abaixo do consenso.",
  );
});

test("manchete voice: strict rater with every signal", () => {
  const verdict = computeVerdict(richInput(), "manchete");
  assert.equal(verdict.headline, "Exigente, anos 2000, movido a drama.");
  assert.equal(
    verdict.sentence,
    "O público raramente te convence — você avalia 0.24★ abaixo do público, e Quentin Tarantino é o diretor a que você sempre volta (6 filmes).",
  );
});

test("generous lean flips the claim in every voice", () => {
  const input = richInput({ contrarian: { tasteLean: 0.31, contrarianScore: 0.5, sampleSize: 20 } });
  assert.equal(computeVerdict(input, "critico").headline, "Paladar generoso.");
  assert.match(computeVerdict(input, "critico").sentence!, /0\.31★ acima do público/);
  assert.match(computeVerdict(input, "retrato").sentence!, /0\.31★ acima do consenso/);
  assert.match(computeVerdict(input, "manchete").sentence!, /O público costuma sair ganhando/);
});

test("inside the neutral band the verdict claims consensus, not a lean", () => {
  const input = richInput({ contrarian: { tasteLean: 0.05, contrarianScore: 0.3, sampleSize: 20 } });
  const verdict = computeVerdict(input, "critico");
  assert.equal(verdict.headline, "Termômetro do consenso.");
  assert.match(verdict.sentence!, /termômetro do gosto médio/);
  assert.doesNotMatch(verdict.sentence!, /0\.05/);
});

test("missing director drops that clause without breaking the sentence", () => {
  const verdict = computeVerdict(richInput({ directors: [] }), "critico");
  assert.equal(
    verdict.sentence,
    "Você encara o consenso de frente — você avalia 0.24★ abaixo do público, na média — com raízes fincadas nos anos 2000 e apetite por drama.",
  );
});

test("lean-only input still produces a verdict in every voice", () => {
  const input = richInput({ decades: [], genres: [], directors: [] });
  for (const voice of ["critico", "retrato", "manchete"] as const) {
    const verdict = computeVerdict(input, voice);
    assert.equal(verdict.thin, false, voice);
    assert.ok(verdict.sentence && verdict.sentence.length > 20, voice);
    assert.ok(!verdict.sentence!.includes("undefined"), voice);
    assert.ok(!/\s\./.test(verdict.sentence!), voice);
  }
});

test("no-lean input (few crowd-rated films) leans on decade/genre/director", () => {
  const input = richInput({ contrarian: { tasteLean: -0.9, contrarianScore: 0.9, sampleSize: 3 } });
  for (const voice of ["critico", "retrato", "manchete"] as const) {
    const verdict = computeVerdict(input, voice);
    assert.equal(verdict.thin, false, voice);
    assert.doesNotMatch(verdict.sentence!, /0\.90|público/, voice);
  }
  assert.equal(computeVerdict(input, "critico").headline, "Coração nos anos 2000.");
});

test("dominant decade is picked by count, not by recency or order", () => {
  const input = richInput({
    decades: [
      { decade: 1970, label: "1970s", count: 12 },
      { decade: 2020, label: "2020s", count: 4 },
    ],
  });
  assert.match(computeVerdict(input, "critico").sentence!, /nos anos 1970/);
});

test("default voice is applied when none is passed", () => {
  const verdict = computeVerdict(richInput());
  assert.equal(verdict.sentence, computeVerdict(richInput(), "critico").sentence);
});
