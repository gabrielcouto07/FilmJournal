import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { buildCanonicalLetterboxdImport, type LetterboxdFiles } from "../src/lib/letterboxd-import";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const header = "Date,Name,Year,Letterboxd URI,Rating,Rewatch,Review,Tags,Watched Date\n";
const fixture: LetterboxdFiles = {
  "diary.csv": `${header}2026-01-02,Arrival,2016,https://boxd.it/watch-1,4.5,,,,2026-01-01\n2026-02-02,Arrival,2016,https://boxd.it/watch-2,5,Yes,,,2026-02-01\n`,
  "reviews.csv": `${header}2026-01-02,Arrival,2016,https://boxd.it/watch-1,4.5,,A precise review,,2026-01-01\n`,
  "ratings.csv": "Date,Name,Year,Letterboxd URI,Rating\n2026-02-02,Arrival,2016,https://boxd.it/arrival,5\n",
  "watched.csv": "Date,Name,Year,Letterboxd URI\n2026-02-02,Arrival,2016,https://boxd.it/arrival\n",
  "watchlist.csv": "Date,Name,Year,Letterboxd URI\n2026-02-02,Heat,1995,https://boxd.it/heat\n",
  "likes/films.csv": "Date,Name,Year,Letterboxd URI\n2026-02-02,Heat,1995,https://boxd.it/heat\n",
};

async function main(): Promise<void> {
  const canonical = buildCanonicalLetterboxdImport(fixture);
  const arrival = canonical.get("arrival:2016");
  const heat = canonical.get("heat:1995");
  assert(arrival, "Arrival should be canonicalized");
  assert.equal(arrival.events.length, 2, "a rating + review must enrich one watch while a real rewatch stays separate");
  assert.equal(arrival.events[0].review, "A precise review", "review text must survive merging");
  assert.equal(arrival.events[1].rewatch, true, "explicit rewatch evidence must survive");
  assert(heat, "watchlist/favorite movie should exist");
  assert.equal(heat.events.length, 0, "watchlist and favorite rows must not create diary events");
  assert.equal(heat.watchlist, true);
  assert.equal(heat.favorite, true);

  const simulatedDb = new Map<string, unknown>();
  for (let pass = 0; pass < 2; pass += 1) {
    for (const film of canonical.values()) for (const event of film.events) simulatedDb.set(event.importKey, event);
  }
  assert.equal(simulatedDb.size, 2, "importing the same canonical source twice must not change the event count");

  const fileNames = ["diary.csv", "reviews.csv", "ratings.csv", "watched.csv", "watchlist.csv", "profile.csv", "likes/films.csv"] as const;
  const actualFiles: LetterboxdFiles = {};
  await Promise.all(fileNames.map(async (name) => {
    try { actualFiles[name] = await readFile(path.join(root, name), "utf8"); } catch { actualFiles[name] = ""; }
  }));
  const actual = buildCanonicalLetterboxdImport(actualFiles);
  const actualEvents = [...actual.values()].flatMap((film) => film.events);
  assert.equal(new Set(actualEvents.map((event) => event.importKey)).size, actualEvents.length, "every canonical event must have a unique stable import identity");
  const prisma = new PrismaClient();
  try {
    const databaseEvents = await prisma.logEntry.findMany({ select: { sourceKey: true, sourceType: true, sourceUri: true } });
    const catalogArtifacts = databaseEvents.filter((entry) => !entry.sourceType.split(",").some((source) => ["diary", "review", "manual"].includes(source.trim())));
    assert.equal(catalogArtifacts.length, 0, "the database must not contain catalog-only diary rows");
    const letterboxdEvents = databaseEvents.filter((entry) => entry.sourceType.includes("diary") || entry.sourceType.includes("review"));
    assert.equal(letterboxdEvents.length, actualEvents.length, "database Letterboxd event count must match canonical export count");
    const uriCounts = new Map<string, number>();
    letterboxdEvents.forEach((entry) => { if (entry.sourceUri) uriCounts.set(entry.sourceUri, (uriCounts.get(entry.sourceUri) ?? 0) + 1); });
    assert.equal([...uriCounts.values()].filter((count) => count > 1).length, 0, "stable Letterboxd event URIs must be unique in the diary");
    console.log(`Letterboxd validation passed: fixture rules verified; export and SQLite both contain ${actualEvents.length} canonical events across ${actual.size} films.`);
  } finally { await prisma.$disconnect(); }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
