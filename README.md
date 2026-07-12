# Private Movie Journal

A personal, private, single-user movie journal inspired by Letterboxd. The app
will import existing Letterboxd export CSVs as seed data and enrich movie
records with metadata and poster artwork from the TMDb REST API for free,
non-commercial use.

## Stack

- Next.js 15 with the App Router and TypeScript
- Prisma ORM with SQLite
- TailwindCSS
- TMDb REST API

## Folder purpose

- `prisma/` — database schema and future seed entry point.
- `src/app/` — application pages, layouts, and API route placeholders.
- `src/components/` — reusable interface components.
- `src/lib/` — shared Prisma and TMDb integrations.
- `src/types/` — shared TypeScript types.
- `scripts/` — data import tooling, including the Letterboxd CSV importer.
- `data/letterboxd-exports/` — local drop location for Letterboxd export CSVs.
- `.env.example` — placeholder for future local environment variables.

## Diary dedupe rule

Each dated diary entry has a semantic `dedupeKey`: the stored movie identity,
effective watch day, rating, and a hash of normalized review text. This safely
merges CSV rows that describe the same watch while preserving legitimate
rewatches on different days. Entries without a trustworthy date are never
automatically merged. Run `npm run dedupe:diary` to clean existing data; the
Letterboxd importer applies the same rule to all future imports.

## Collections and external IDs

Watchlist movies are stored separately from diary entries and retain their saved
timestamp for ordering. The Top 10 is stored as a unique movie-level rank; rank
changes swap atomically. `npm run backfill:collections` timestamps existing
watchlist items and promotes legacy favorite diary entries into available Top 10
positions. IMDb IDs are populated from TMDb external identifiers when available;
the app deliberately does not scrape IMDb ratings.
