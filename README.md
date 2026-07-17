# FilmJournal v2

FilmJournal is a private, single-user film platform built with Next.js 15, React 19, Prisma, SQLite, Tailwind CSS, and TMDb. FilmJournal combines a canonical Letterboxd import with a cinematic dashboard, real diary tools, discovery, artwork customization, watchlist management, a persistent Top 10, personal stats, and an interactive movie roulette.

---

## 1. Stack & Architecture
* **Frontend Framework**: Next.js 15 (App Router), React 19
* **Database & ORM**: SQLite via Prisma Client 6.0
* **Styling**: Tailwind CSS v3.4, cinematic dark + gold/amber theme, `next/font` (Playfair Display headings, Inter body)
* **Animation**: framer-motion (page transitions, roulette winner reveal)
* **APIs**: Server-side Next.js route handlers
* **Authentication**: NextAuth.js v5 (Auth.js) with a Credentials provider (JWT sessions)

---

## 2. Prerequisites & Environment Setup
To run the project, copy the example environment file:
```bash
cp .env.example .env.local
```
Then configure the following environment variables:
* `DATABASE_URL`: Connection string for Prisma (e.g. `file:./dev.db`)
* `TMDB_API_KEY`: API Key for TMDb integrations (to fetch details, credits, and search)
* `AUTH_SECRET`: NextAuth.js secret for signing session JWTs (≥32 chars). Generate with `npx auth secret` or `openssl rand -base64 32`. **Required** in production.
* `AUTH_TRUST_HOST`: Set to `true` when self-hosting behind a proxy (non-Vercel).
* `APP_OWNER_USERNAME`: Username for the journal owner (defaults to `admin`)
* `APP_OWNER_EMAIL`: Email for the journal owner (defaults to `admin@filmjournal.local`)
* `APP_OWNER_PASSWORD`: Password for the journal owner. **Required** to seed the owner account via the data migration below — set this to the password you want to log in with.

---

## 3. First Run, Database Migration, and Seeding

To set up the database and run the data migrations, run these commands in order:

```bash
# 1. Install dependencies
npm install

# 2. Push schema changes to the SQLite database
npm run db:push

# 3. Generate the Prisma Client
npm run db:generate

# 4. Migrate existing single-user data to the new User and UserMovie models
npx tsx scripts/migrate-user-data.ts

# 5. Clean up duplicates (optional)
npm run db:dedupe:apply

# 6. Seed/Import Letterboxd data (if any CSV files are present)
npm run import:letterboxd

# 7. Run validations
npm run validate:letterboxd
```

> [!IMPORTANT]
> Stop the Next.js development server (`next dev`) before running `db:generate` or migrations on Windows. Otherwise, Prisma's native query engine can be file-locked.

---

## 4. Local Execution & Build
```bash
# Start development server
npm run dev

# Run TypeScript type check
npm run typecheck

# Build for production
npm run build

# Start production server
npm run start
```

---

## 5. Owner Authentication (NextAuth.js v5)
FilmJournal v2 separates the visitor view from the editor view:
* **Public Visitor View**: Anyone can visit the site and browse the owner's diary, stats, watchlist, Top 10, and spin the Movie Roulette. All interactive edit/delete/rating actions are hidden.
* **Owner Editor View**: The owner navigates to `/login` and authenticates with the Credentials provider using the username/password seeded from `APP_OWNER_*`. Once authenticated, the owner gains access to quick actions, star ratings, custom poster choices, adding movies, writing reviews, logging watches, and the `/admin` console.
* **Sessions**: JWT strategy via NextAuth. Config is split into an Edge-safe `src/auth.config.ts` (callbacks + the `/admin` gate) and `src/auth.ts` (Credentials provider + Prisma). The route handler lives at `src/app/api/auth/[...nextauth]/route.ts`.
* **Route protection**: `src/middleware.ts` gates `/admin/*` via the session; unauthenticated visitors are redirected to `/login`. Write endpoints (`POST`/`PATCH`/`DELETE` under `/api/movies` and `/api/logs`) additionally verify the session server-side and require the `OWNER` role.

---

## 6. Movie Roulette Architecture (`/roulette`)
The Movie Roulette helps users decide what to watch from the owner's archive.
* **Selection Logic**: The selection uses `window.crypto.getRandomValues` to ensure cryptographic randomness and avoid modulo bias.
* **Filters**:
  * Genres (multiple selection)
  * Minimum Personal Rating
  * Decade selection
  * Max Runtime limit
  * Favorites only toggle
  * Exclude recently watched toggle (excludes films watched in the last 30 days)
  * Principal Cast Search (searches for actor name in TMDb credit records)
  * Candidate count (4 to 12 candidates)
* **Accessibility**: Fully keyboard navigable, screen-reader friendly, responsive, and honors `prefers-reduced-motion` (instantly displaying the winner instead of running the spin ticker).

---

## 7. Current Limitations & Next Steps
* **Impediment**: Single-user owner session is managed statelessly.
* **Roadmap**: Refer to [docs/NEXT_PHASE_MULTIUSER_AND_IMPORT.md](file:///C:/Users/GABRIEL.CARDOSO/Documents/ERP/Letterboxc/docs/NEXT_PHASE_MULTIUSER_AND_IMPORT.md) for full plans on adding public registrations, namespaced routes (`/u/[username]`), and a self-service Letterboxd CSV/ZIP import tool.
