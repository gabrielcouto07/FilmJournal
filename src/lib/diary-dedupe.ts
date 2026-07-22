type DedupeInput = {
  movieId: string;
  watchedAt?: Date | null;
  loggedAt?: Date | null;
  occurrence?: number;
  catalogOnly?: boolean;
};

export function normalizeTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLocaleLowerCase("en-US");
}

export function normalizeText(value: string | null | undefined): string {
  return (value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("en-US");
}

export function createFilmIdentity(title: string, year: number | null | undefined): string {
  return `${normalizeTitle(title)}:${year ?? "unknown"}`;
}

/** Identifica a sessão sem depender de nota, resenha ou tags que podem mudar. */
export function createDiaryDedupeKey({
  movieId,
  watchedAt,
  loggedAt,
  occurrence = 1,
  catalogOnly = false,
}: DedupeInput): string {
  if (catalogOnly) return `v2:${movieId}:catalog`;
  const effectiveDate = watchedAt ?? loggedAt;
  const day = effectiveDate ? effectiveDate.toISOString().slice(0, 10) : "undated";
  return `v2:${movieId}:${day}:${Math.max(1, occurrence)}`;
}

export function hasSource(sourceType: string, source: string): boolean {
  return sourceType.split(",").some((value) => value.trim() === source);
}

export function isAuthoritativeWatch(sourceType: string): boolean {
  return hasSource(sourceType, "diary") || hasSource(sourceType, "review") || hasSource(sourceType, "manual");
}
