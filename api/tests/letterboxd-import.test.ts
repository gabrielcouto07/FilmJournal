import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCanonicalLetterboxdImport,
  LetterboxdImportValidationError,
  parseCsv,
} from "../src/lib/letterboxd-import.js";

test("parseCsv supports quoted commas and escaped quotes", () => {
  const rows = parseCsv('Name,Review\r\n"Paris, Texas","A ""perfect"" film"\r\n');
  assert.deepEqual(rows, [{ Name: "Paris, Texas", Review: 'A "perfect" film' }]);
});

test("parseCsv rejects an unterminated quoted field", () => {
  assert.throws(
    () => parseCsv('Name,Review\nFilm,"unfinished'),
    LetterboxdImportValidationError,
  );
});

test("canonical import merges a diary entry with its same-day review", () => {
  const films = buildCanonicalLetterboxdImport({
    "diary.csv": "Date,Name,Year,Letterboxd URI,Rating,Rewatch,Watched Date\n2024-01-02,Film,2020,https://letterboxd.com/user/film/film/,4.5,No,2024-01-01\n",
    "reviews.csv": "Date,Name,Year,Letterboxd URI,Rating,Rewatch,Review,Tags,Watched Date\n2024-01-02,Film,2020,https://letterboxd.com/user/film/film/,4.5,No,Great,cinema,2024-01-01\n",
  });

  const film = [...films.values()][0];
  assert.equal(films.size, 1);
  assert.equal(film.events.length, 1);
  assert.equal(film.events[0].review, "Great");
  assert.deepEqual(film.events[0].sourceTypes.sort(), ["diary", "review"]);
});

test("rows without a Letterboxd film name are ignored", () => {
  const films = buildCanonicalLetterboxdImport({ "watched.csv": "Wrong,Headers\nNo,Film\n" });
  assert.equal(films.size, 0);
});
