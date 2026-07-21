/**
 * Guess-by-Cast — pure matching + scoring logic. No I/O here so everything is
 * unit-testable (tests/play-scoring.test.ts). The round token / TMDB plumbing
 * lives in src/lib/play/token.ts and the /api/play routes.
 */

export const MAX_REVEALS = 5;
export const ROUND_MS = 60_000;
export const ROUNDS_PER_RUN = 5;

/** Leading articles ignored when comparing guesses (en/pt/es/fr/de/it). */
const LEADING_ARTICLES = new Set([
  "the", "a", "an",
  "o", "os", "as", "um", "uma", "uns", "umas",
  "el", "la", "los", "las", "un", "una",
  "le", "les", "des", "du",
  "der", "die", "das", "ein", "eine",
  "il", "lo", "gli", "i",
]);

/** Fold accents/case/punctuation and drop a leading article. */
export function normalizeGuess(value: string): string {
  const words = value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " e ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  if (words.length > 1 && LEADING_ARTICLES.has(words[0])) words.shift();
  return words.join(" ");
}

/** Levenshtein distance with early exit — guesses and titles are short. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const rows = a.length + 1;
  const cols = b.length + 1;
  let previous = Array.from({ length: cols }, (_, j) => j);
  for (let i = 1; i < rows; i += 1) {
    const current = [i];
    for (let j = 1; j < cols; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[cols - 1];
}

/** Typo tolerance scales gently with length; short titles must match exactly. */
function allowedDistance(target: string): number {
  if (target.length >= 12) return 2;
  if (target.length >= 5) return 1;
  return 0;
}

/**
 * A guess is correct when it matches any accepted title (display title,
 * original title) after normalization — exactly, minus a subtitle
 * (": Part Two", "- O Retorno"), or within a small typo distance.
 */
export function isCorrectGuess(guess: string, acceptedTitles: Array<string | null | undefined>): boolean {
  const normalizedGuess = normalizeGuess(guess);
  if (!normalizedGuess) return false;

  for (const title of acceptedTitles) {
    if (!title) continue;
    const forms = new Set<string>([normalizeGuess(title)]);
    const subtitleSplit = title.split(/[:—–]|( - )/)[0];
    if (subtitleSplit && subtitleSplit !== title) forms.add(normalizeGuess(subtitleSplit));

    for (const form of forms) {
      if (!form) continue;
      if (form === normalizedGuess) return true;
      if (editDistance(form, normalizedGuess) <= allowedDistance(form)) return true;
    }
  }
  return false;
}

/**
 * Round score: fewer cast reveals = more points, plus a bonus for speed.
 * reveals 1..5 → 1000/850/700/550/400 base; time bonus decays linearly from
 * 200 to 0 across the round. A missed round scores 0 (callers pass solved=false).
 */
export function computeRoundScore(options: { solved: boolean; revealedCount: number; elapsedMs: number; roundMs?: number }): number {
  if (!options.solved) return 0;
  const roundMs = options.roundMs ?? ROUND_MS;
  const reveals = Math.min(Math.max(options.revealedCount, 1), MAX_REVEALS);
  const base = 1000 - (reveals - 1) * 150;
  const timeLeftRatio = Math.max(0, 1 - options.elapsedMs / roundMs);
  return base + Math.round(200 * timeLeftRatio);
}
