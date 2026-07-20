import { createHash } from "node:crypto";
import { createFilmIdentity, normalizeText } from "./diary-dedupe";

export type CsvRow = Record<string, string>;

export type LetterboxdEvent = {
  importKey: string;
  sourceUri: string | null;
  loggedAt: Date | null;
  watchedAt: Date | null;
  rating: number | null;
  review: string | null;
  rewatch: boolean;
  tags: string | null;
  sourceTypes: string[];
};

export type LetterboxdFilm = {
  key: string;
  name: string;
  year: number | null;
  letterboxdUri: string | null;
  watched: boolean;
  rating: number | null;
  favorite: boolean;
  profileRank: number | null;
  watchlist: boolean;
  watchlistAddedAt: Date | null;
  events: LetterboxdEvent[];
};

export type LetterboxdFile =
  | "diary.csv"
  | "reviews.csv"
  | "ratings.csv"
  | "watched.csv"
  | "watchlist.csv"
  | "profile.csv"
  | "likes/films.csv";

export type LetterboxdFiles = Partial<Record<LetterboxdFile, string>>;

export const MAX_LETTERBOXD_ROWS_PER_FILE = 50_000;

export class LetterboxdImportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LetterboxdImportValidationError";
  }
}

export function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (character === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  if (quoted) {
    throw new LetterboxdImportValidationError("Um dos CSVs está malformado (aspas não foram fechadas).");
  }
  if (rows.length > MAX_LETTERBOXD_ROWS_PER_FILE + 1) {
    throw new LetterboxdImportValidationError(
      `Um dos CSVs excede o limite de ${MAX_LETTERBOXD_ROWS_PER_FILE.toLocaleString("pt-BR")} linhas.`,
    );
  }

  const headers = (rows.shift() ?? []).map((header) => header.replace(/^\uFEFF/, "").trim());
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

export function parseLetterboxdDate(value?: string): Date | null {
  if (!value?.trim()) return null;
  const date = new Date(`${value.trim()}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseYear(value?: string): number | null {
  const year = Number(value);
  return Number.isInteger(year) && year > 1800 && year < 2200 ? year : null;
}

function parseRating(value?: string): number | null {
  const rating = Number(value);
  return value && Number.isFinite(rating) && rating >= 0.5 && rating <= 5 ? rating : null;
}

function parseBoolean(value?: string): boolean {
  return ["yes", "true", "1"].includes(value?.trim().toLowerCase() ?? "");
}

function day(date: Date | null): string {
  return date?.toISOString().slice(0, 10) ?? "undated";
}

function unionCommaValues(...values: Array<string | null | undefined>): string | null {
  const items = [...new Set(values.flatMap((value) => (value ?? "").split(",").map((item) => item.trim()).filter(Boolean)))];
  return items.length ? items.join(", ") : null;
}

function filmFor(films: Map<string, LetterboxdFilm>, row: CsvRow): LetterboxdFilm {
  const name = row.Name?.trim() || "Unknown title";
  const year = parseYear(row.Year);
  const key = createFilmIdentity(name, year);
  const existing = films.get(key);
  if (existing) return existing;
  const film: LetterboxdFilm = {
    key,
    name,
    year,
    letterboxdUri: null,
    watched: false,
    rating: null,
    favorite: false,
    profileRank: null,
    watchlist: false,
    watchlistAddedAt: null,
    events: [],
  };
  films.set(key, film);
  return film;
}

function eventFromRow(row: CsvRow, sourceType: "diary" | "review", filmKey: string, fallbackIndex: number): LetterboxdEvent {
  const sourceUri = row["Letterboxd URI"]?.trim() || null;
  const loggedAt = parseLetterboxdDate(row.Date);
  const watchedAt = parseLetterboxdDate(row["Watched Date"]);
  const rating = parseRating(row.Rating);
  const review = row.Review?.trim() || null;
  const rewatch = parseBoolean(row.Rewatch);
  const tags = row.Tags?.trim() || null;
  const contentFingerprint = createHash("sha256")
    .update([filmKey, day(watchedAt ?? loggedAt), rating ?? "unrated", normalizeText(review), rewatch ? "rewatch" : "first"].join("|"))
    .digest("hex")
    .slice(0, 20);
  const importKey = sourceUri
    ? `letterboxd:event:${sourceUri.toLowerCase()}`
    : `letterboxd:event:${filmKey}:${day(watchedAt ?? loggedAt)}:${contentFingerprint}:${fallbackIndex}`;
  return { importKey, sourceUri, loggedAt, watchedAt, rating, review, rewatch, tags, sourceTypes: [sourceType] };
}

function mergeEvent(target: LetterboxdEvent, incoming: LetterboxdEvent): void {
  target.loggedAt ??= incoming.loggedAt;
  target.watchedAt ??= incoming.watchedAt;
  target.rating ??= incoming.rating;
  if (!target.review?.trim() && incoming.review?.trim()) target.review = incoming.review;
  target.rewatch ||= incoming.rewatch;
  target.tags = unionCommaValues(target.tags, incoming.tags);
  target.sourceUri ??= incoming.sourceUri;
  target.sourceTypes = [...new Set([...target.sourceTypes, ...incoming.sourceTypes])];
  // A diary URI is the strongest watch-event identity. If a review companion
  // supplies the only URI, use that stable URI instead of the content fallback.
  if (!target.importKey.includes("https://") && incoming.sourceUri) target.importKey = incoming.importKey;
}

function effectiveTime(event: LetterboxdEvent): number {
  return (event.watchedAt ?? event.loggedAt)?.getTime() ?? Number.NEGATIVE_INFINITY;
}

export function buildCanonicalLetterboxdImport(files: LetterboxdFiles): Map<string, LetterboxdFilm> {
  const films = new Map<string, LetterboxdFilm>();
  const rows = (name: keyof LetterboxdFiles) => parseCsv(files[name] ?? "").filter((row) =>
    name === "profile.csv" || Boolean(row.Name?.trim()),
  );

  rows("diary.csv").forEach((row, index) => {
    const film = filmFor(films, row);
    film.watched = true;
    film.events.push(eventFromRow(row, "diary", film.key, index + 1));
  });

  rows("reviews.csv").forEach((row, index) => {
    const film = filmFor(films, row);
    film.watched = true;
    const incoming = eventFromRow(row, "review", film.key, index + 1);
    const eventDay = day(incoming.watchedAt ?? incoming.loggedAt);
    const sameDay = film.events.filter((event) => day(event.watchedAt ?? event.loggedAt) === eventDay);
    const match = film.events.find((event) => incoming.sourceUri && event.sourceUri === incoming.sourceUri)
      ?? (sameDay.length === 1 ? sameDay[0] : undefined);
    if (match) mergeEvent(match, incoming);
    else film.events.push(incoming);
  });

  rows("ratings.csv").forEach((row) => {
    const film = filmFor(films, row);
    film.letterboxdUri ??= row["Letterboxd URI"]?.trim() || null;
    film.rating = parseRating(row.Rating) ?? film.rating;
  });

  rows("watched.csv").forEach((row) => {
    const film = filmFor(films, row);
    film.letterboxdUri ??= row["Letterboxd URI"]?.trim() || null;
    film.watched = true;
  });

  rows("watchlist.csv").forEach((row) => {
    const film = filmFor(films, row);
    film.letterboxdUri ??= row["Letterboxd URI"]?.trim() || null;
    film.watchlist = true;
    film.watchlistAddedAt ??= parseLetterboxdDate(row.Date);
  });

  rows("likes/films.csv").forEach((row) => {
    const film = filmFor(films, row);
    film.letterboxdUri ??= row["Letterboxd URI"]?.trim() || null;
    film.favorite = true;
  });

  const profileFavoriteUris = ((rows("profile.csv")[0]?.["Favorite Films"] ?? "").split(","))
    .map((uri) => uri.trim()).filter(Boolean);
  profileFavoriteUris.forEach((uri, index) => {
    const film = [...films.values()].find((candidate) => candidate.letterboxdUri === uri);
    if (film) {
      film.favorite = true;
      film.profileRank = index + 1;
    }
  });

  for (const film of films.values()) {
    film.events.sort((left, right) => effectiveTime(left) - effectiveTime(right) || left.importKey.localeCompare(right.importKey));
    // A catalog rating is current film state. It may fill the newest real event,
    // but it never creates an event and never replaces a historical event rating.
    const latest = film.events.at(-1);
    if (latest && latest.rating == null) latest.rating = film.rating;
  }

  return films;
}
