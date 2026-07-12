import { createHash } from "node:crypto";

type DedupeInput = {
  movieId: string;
  watchedAt?: Date | null;
  loggedAt?: Date | null;
  rating?: number | null;
  review?: string | null;
};

export function normalizeReview(review: string | null | undefined): string {
  return (review ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

/**
 * A diary entry is considered the same import when it is for the same stored movie,
 * on the same effective day, with the same rating and normalized review text. Entries
 * without a date intentionally return null: merging those would be unsafe for rewatches.
 */
export function createDiaryDedupeKey({ movieId, watchedAt, loggedAt, rating, review }: DedupeInput): string | null {
  const effectiveDate = watchedAt ?? loggedAt;
  if (!effectiveDate) return null;

  const day = effectiveDate.toISOString().slice(0, 10);
  const normalizedRating = rating == null ? "unrated" : rating.toFixed(1);
  const reviewHash = createHash("sha256").update(normalizeReview(review)).digest("hex").slice(0, 16);

  return `v1:${movieId}:${day}:${normalizedRating}:${reviewHash}`;
}
