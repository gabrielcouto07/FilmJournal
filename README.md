# 🎬 FilmJournal

Personal film tracking app — log, rate, and explore your movie collection.

Built with **Next.js 15** · **TypeScript** · **Tailwind CSS** · **Prisma** · **PostgreSQL** · **NextAuth.js**

***

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15 App Router, Tailwind CSS |
| Auth | NextAuth.js v5 (Credentials) |
| Database | PostgreSQL via Prisma ORM |
| Hosting | Vercel (frontend) + Neon (DB) |
| External API | TMDB |

***

## Local Setup

### 1. Clone & install
```bash
git clone https://github.com/gabrielcouto07/FilmJournal
cd FilmJournal
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your own values for:

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `TMDB_API_KEY`
- `APP_OWNER_USERNAME`
- `APP_OWNER_PASSWORD`

Next.js reads `.env.local`. If Prisma on your local setup reads `.env`, duplicate
the same values into a local `.env` file. Never commit either `.env.local` or
`.env`; both are intentionally ignored by git.

**Local DB option — Docker:**
```bash
docker run -d --name filmjournal-db \
  -e POSTGRES_PASSWORD=dev \
  -e POSTGRES_DB=filmjournal \
  -p 5432:5432 postgres:16
```
Then set `DATABASE_URL="postgresql://postgres:dev@localhost:5432/filmjournal"` in `.env.local`.

### 3. Push database schema
```bash
npm run db:push
```

### 4. Start dev server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) and sign in at `/login` with
the configured owner credentials. The first owner login creates the account when
it does not exist yet.

***

## Deploy to Vercel + Neon (free tier)

1. Create a PostgreSQL database at [neon.tech](https://neon.tech) (free)
2. Import this repo at [vercel.com](https://vercel.com)
3. Use the pooled Neon connection string for `DATABASE_URL` and the direct
   (non-pooled) Neon connection string for `DIRECT_URL`.
4. Add these environment variables in the Vercel dashboard:
   - `DATABASE_URL` — pooled connection string from Neon
   - `DIRECT_URL` — direct connection string from Neon
   - `NEXTAUTH_URL` — your Vercel deployment URL
   - `NEXTAUTH_SECRET` — run `openssl rand -base64 32`
   - `TMDB_API_KEY` — from [themoviedb.org](https://www.themoviedb.org/settings/api)
   - `APP_OWNER_USERNAME` — username for the initial owner account
   - `APP_OWNER_PASSWORD` — strong password for the initial owner account
5. For a fresh Neon database, initialize the schema once from a trusted local
   terminal with the Neon environment variables loaded:

```bash
npm run db:push
```

   Commit future `prisma/migrations/` directories and apply them in production
   with `npm run db:migrate`.

`APP_OWNER_USERNAME` and `APP_OWNER_PASSWORD` are used to auto-create the initial
owner account. Once that username exists, the app resolves and promotes it without
reading the bootstrap password, so `APP_OWNER_PASSWORD` can be rotated or removed.
Keep `APP_OWNER_USERNAME` configured so public journal pages can resolve the owner.

***

## Useful commands

| Command | Description |
|---|---|
| `npm run dev` | Start local dev server |
| `npm run build` | Build for production |
| `npm run typecheck` | TypeScript check |
| `npm run db:push` | Sync schema to DB (dev) |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:migrate` | Run migrations (prod) |
| `npm test` | Run the unit test suite (node:test) |

***

## Applying database migrations

The schema now has a real migration history under `prisma/migrations/`. For a
database that was previously created with `db push` (existing Neon databases),
baseline once and then deploy:

```bash
# Recommended: point DATABASE_URL/DIRECT_URL at a Neon BRANCH first, verify,
# then repeat against production.
npx prisma migrate resolve --applied 20260721000000_init   # mark the baseline
npx prisma migrate deploy                                   # apply the rest
```

A brand-new database needs only `npx prisma migrate deploy`. The app is
resilient pre-migration (settings fall back to defaults; saving preferences
returns a clear error until `UserSettings` exists), but the migrations should be
applied before real multi-user use.

***

## Profile, settings & public profiles

- `/profile` — avatar (client-resized data URL or external https URL), display
  name, bio, preferences (theme, accent color, language, rating scale,
  half-stars, date format, region, default landing page, adult content), privacy
  (public/private profile), account (change password/email, delete account) and
  the Letterboxd importer.
- `/u/[username]` — read-only public profile (favorites, recent activity,
  stats), visible only when the user sets **Perfil público** in
  `/profile → Privacidade`.

Avatars are stored as small data URLs or external URLs today; to move uploads to
Vercel Blob later, provision `BLOB_READ_WRITE_TOKEN` (see `.env.example`).

***

## Import Letterboxd Data Safely

The importer is idempotent — re-running reconciles existing rows instead of
duplicating them — and it runs against whatever `DATABASE_URL` is loaded from
`.env.local` (falling back to `.env`). **If that points at your production Neon
database, a live import writes straight to production.** Follow this flow:

1. **Export from Letterboxd:** Settings → Data → *Export your data*. Download the ZIP.
2. **Unzip it.**
3. **Place the CSVs in the repo root** (`Letterboxc/`). The importer reads any
   subset of these (missing files are ignored):
   - `diary.csv` · `reviews.csv` · `ratings.csv` · `watched.csv`
   - `watchlist.csv` · `profile.csv` · `likes/films.csv` (keep the `likes/` subfolder)
4. **Dry run first (zero writes).** Prints a safety banner (target DB host/name,
   owner, TMDB status) and a summary of what *would* be created/updated:
   ```bash
   npm run import:letterboxd:dry
   ```
5. **Run the live import.** Live runs require explicit confirmation — either the
   `--yes` flag or typing `yes` at the interactive prompt:
   ```bash
   npm run import:letterboxd -- --yes
   # or, to be prompted interactively:
   npm run import:letterboxd
   ```
   Add `--skip-metadata` to skip TMDB enrichment.
6. **Validate after import** (read-only; compares the database to the export):
   ```bash
   npm run validate:letterboxd
   ```
7. **Optional dedupe.** Preview first (no writes), then apply only if it looks right:
   ```bash
   npm run db:dedupe          # preview
   npm run db:dedupe:apply    # apply
   ```
8. **Delete the export CSVs from the repo root** once the import is done.

> ⚠️ **Never commit export CSVs** — they contain personal data. The repo's
> `.gitignore` already excludes `*.csv` (including `likes/films.csv`), but
> double-check `git status` before committing. Take a Neon branch/snapshot
> before your first live import as a safety net.

***

## Security

- Passwords hashed with `scrypt` (Node built-in, no external deps)
- `NEXTAUTH_SECRET` required in all environments
- `.env` files are gitignored — never commit secrets
- Registration rate-limited (5/IP per 10 min) via a shared `RateLimit` table
  (survives serverless cold starts; in-memory fallback pre-migration)
- Password change/email change/account deletion require the current password and
  are rate-limited against brute force
- State-changing API routes reject cross-origin requests (CSRF hardening)
- Reserved usernames blocked; private journals are never exposed via `/u/…`
