import { NextResponse } from "next/server";
import {
  buildCanonicalLetterboxdImport,
  type LetterboxdFiles,
} from "@/lib/letterboxd-import";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Filenames Letterboxd puts in its export ZIP. We accept any subset.
const KNOWN_FILES: Array<keyof LetterboxdFiles> = [
  "diary.csv",
  "reviews.csv",
  "ratings.csv",
  "watched.csv",
  "watchlist.csv",
  "profile.csv",
  "likes/films.csv",
];

const MAX_TOTAL_BYTES = 15 * 1024 * 1024; // 15MB guardrail against oversized uploads

/**
 * Phase 2 scaffold: accepts a multipart upload of Letterboxd CSVs, parses and
 * canonicalizes them, and returns an import summary.
 *
 * TODO: protect this route — only authenticated users can import their own data.
 *       (Resolve the session via `getCurrentUser()` / NextAuth `auth()` and reject anonymous requests.)
 * TODO: persist the parsed films/events into Movie + UserMovie + LogEntry scoped
 *       to the requesting user's id (see scripts/import-letterboxd.ts for the
 *       global write logic to adapt into a per-user, transactional service).
 */
export async function POST(request: Request) {
  const errors: string[] = [];

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { imported: 0, skipped: 0, errors: ["Expected a multipart/form-data upload of Letterboxd CSV files."] },
      { status: 400 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { imported: 0, skipped: 0, errors: ["Could not read the uploaded form data."] },
      { status: 400 },
    );
  }

  const files: LetterboxdFiles = {};
  let totalBytes = 0;

  for (const key of KNOWN_FILES) {
    // Accept either the exact filename or a bare field name (e.g. "diary").
    const entry = form.get(key) ?? form.get(key.replace(/\.csv$/, "").replace("likes/", ""));
    if (!(entry instanceof File)) continue;

    totalBytes += entry.size;
    if (totalBytes > MAX_TOTAL_BYTES) {
      return NextResponse.json(
        { imported: 0, skipped: 0, errors: [`Upload exceeds the ${MAX_TOTAL_BYTES / (1024 * 1024)}MB limit.`] },
        { status: 413 },
      );
    }

    try {
      files[key] = await entry.text();
    } catch {
      errors.push(`Failed to read ${key}.`);
    }
  }

  if (Object.keys(files).length === 0) {
    return NextResponse.json(
      { imported: 0, skipped: 0, errors: ["No recognized Letterboxd CSV files were provided.", ...errors] },
      { status: 400 },
    );
  }

  let filmCount = 0;
  let eventCount = 0;
  try {
    const films = buildCanonicalLetterboxdImport(files);
    filmCount = films.size;
    for (const film of films.values()) eventCount += film.events.length;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Failed to parse the Letterboxd export.");
  }

  // Scaffold response: `imported` reflects parseable candidates. Actual DB
  // persistence is deferred to Phase 2 (see TODOs above).
  return NextResponse.json({
    imported: filmCount,
    skipped: 0,
    errors,
    detail: {
      films: filmCount,
      diaryEvents: eventCount,
      filesReceived: Object.keys(files),
      persisted: false,
      note: "Dry-run parse only. Wire up per-user persistence to complete the importer.",
    },
  });
}
