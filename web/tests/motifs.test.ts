import assert from "node:assert/strict";
import test from "node:test";
import {
  computeMotifs,
  computeMotifSummary,
  highlyRatedThreshold,
  isStopKeyword,
  keywordLabel,
  MIN_HIGHLY_RATED,
  MIN_MOTIF_COUNT,
  type MotifFilm,
} from "../src/lib/analytics/motifs";

function film(userRating: number, keywords: string[]): MotifFilm {
  return { userRating, keywords };
}

/** Cria filmes bem avaliados com as mesmas palavras-chave. */
function batch(count: number, keywords: string[], rating = 5): MotifFilm[] {
  return Array.from({ length: count }, () => film(rating, keywords));
}

test("highlyRatedThreshold uses the top quartile, capped at 4.5", () => {
  // Notas altas: o quartil chega a 5, mas o corte para em 4,5.
  assert.equal(highlyRatedThreshold([5, 5, 5, 5]), 4.5);
  // Notas rígidas: o corte acompanha o quartil em 4.
  assert.equal(highlyRatedThreshold([2, 2.5, 3, 3, 3.5, 3.5, 4, 4]), 4);
  // Diário vazio usa o corte padrão de 4,5.
  assert.equal(highlyRatedThreshold([]), 4.5);
});

test("isStopKeyword drops credits stingers, provenance, production meta and mood tags", () => {
  for (const generic of [
    "aftercreditsstinger",
    "duringcredits scene",
    "Based on Novel or Book",
    "woman director",
    "sequel",
    "3d animation",
    "feel-good",
    "bold",
  ]) {
    assert.equal(isStopKeyword(generic), true, generic);
  }
  for (const real of ["memory", "isolation", "father son relationship", "new york city"]) {
    assert.equal(isStopKeyword(real), false, real);
  }
});

test("keywordLabel translates known keywords and falls back to the raw name", () => {
  assert.equal(keywordLabel("Memory"), "memória");
  assert.equal(keywordLabel("father son relationship"), "relações entre pai e filho");
  assert.equal(keywordLabel("kaiju"), "kaiju");
});

test("computeMotifs counts a keyword once per film, ranks by recurrence and applies the stoplist", () => {
  const films = [
    ...batch(5, ["memory", "memory", "sequel"]), // dupes within a film count once; sequel stoplisted
    ...batch(4, ["isolation"]),
    ...batch(3, ["father son relationship"]),
    ...batch(2, ["kaiju"]), // below MIN_MOTIF_COUNT
  ];
  const motifs = computeMotifs(films);
  assert.deepEqual(
    motifs.map((motif) => [motif.keyword, motif.count]),
    [["memory", 5], ["isolation", 4], ["father son relationship", 3]],
  );
  assert.equal(motifs[2].label, "relações entre pai e filho");
});

test("computeMotifs only looks at highly-rated films", () => {
  const films = [
    ...batch(MIN_HIGHLY_RATED, ["memory"], 5),
    // Filmes com nota baixa não podem criar um tema recorrente.
    ...batch(20, ["torture"], 1),
  ];
  const motifs = computeMotifs(films);
  assert.deepEqual(motifs.map((motif) => motif.keyword), ["memory"]);
});

test("computeMotifSummary builds the evocative pt-BR sentence", () => {
  // Contagens diferentes deixam a ordem sem ambiguidade.
  const films = [
    ...batch(4, ["memory", "isolation", "father son relationship", "kaiju"]),
    ...batch(2, ["memory", "isolation", "father son relationship"]),
    ...batch(1, ["memory", "isolation"]),
    ...batch(1, ["memory"]),
  ];
  const summary = computeMotifSummary(films);
  assert.equal(summary.highlyRatedCount, 8);
  assert.equal(summary.sentence, "Seus favoritos voltam sempre a: memória, isolamento e relações entre pai e filho.");
});

test("computeMotifSummary hides the section when data is too thin", () => {
  // Poucos filmes bem avaliados.
  const fewFilms = computeMotifSummary(batch(MIN_HIGHLY_RATED - 1, ["memory", "isolation"]));
  assert.equal(fewFilms.sentence, null);
  assert.deepEqual(fewFilms.motifs, []);

  // Há filmes, mas as palavras-chave não se repetem o bastante.
  const scattered = computeMotifSummary(
    Array.from({ length: 12 }, (_, index) => film(5, [`keyword-${index}`])),
  );
  assert.equal(scattered.sentence, null);

  // Um único tema não basta para montar a frase.
  const single = computeMotifSummary([
    ...batch(MIN_MOTIF_COUNT, ["memory"]),
    ...Array.from({ length: MIN_HIGHLY_RATED - MIN_MOTIF_COUNT }, (_, index) => film(5, [`unique-${index}`])),
  ]);
  assert.equal(single.sentence, null);

  // Nenhum filme avaliado.
  assert.equal(computeMotifSummary([]).sentence, null);
});
