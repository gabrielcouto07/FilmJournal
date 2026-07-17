# Current Architecture Audit - Film Journal

This document describes the audited state of the Film Journal application before making the changes for multi-user separation, owner authentication, and the movie roulette feature.

## 1. Current Stack
* **Framework**: Next.js 15 (using App Router)
* **Language**: TypeScript 5.7
* **Database & ORM**: SQLite via Prisma Client 6.0
* **Styling**: Tailwind CSS v3.4 & PostCSS
* **Core Packages**: React 19, `@prisma/client`

## 2. Project Structure
* `src/app/`: Core routing structure of the application.
  * `api/`: API endpoints (`/api/movies` for movie catalog updates, `/api/logs` for diary logs, `/api/tmdb` for TMDB integrations).
  * `diary/`: Film diary explorer and list/poster views.
  * `favorites/`: Rankable favorites view (Top 10).
  * `film/[id]/`: Detailed view of a movie, showing credits, director, custom backdrops, user review, ratings, and watch history.
  * `search/`: TMDB search and category rails (Popular, Trending, etc.).
  * `stats/`: Dashboard statistics based on logged views, rating distributions, and rhythm.
  * `watchlist/`: Movie queue.
* `src/components/`: Reusable UI elements (site header, cards, logs, commands).
* `src/lib/`: Library utilities (`prisma.ts`, `tmdb.ts`, `letterboxd-import.ts`, `diary-dedupe.ts`, `recommendations.ts`).
* `scripts/`: Seed and Letterboxd CSV processing scripts.

## 3. Data Flow
* **Movie Catalog**: Added via `/api/movies` using the `POST` request, which fetches metadata from the TMDb API (`src/lib/tmdb.ts`) and stores it in the `Movie` model.
* **Diary Events**: Logged via `/api/logs`, creating a `LogEntry` linked to a `Movie`.
* **Personal Interactions**: Watched status, ratings, watchlist, and favorites are currently stored directly as attributes of the global `Movie` record.
* **TMDb Fetching**: Performed server-side or via `/api/tmdb` with caching (SWR/6-hour revalidation).

## 4. Current Models (Schema)
* **Movie**: Holds both metadata (title, year, genres, posterPath, directors, etc.) and user-specific states (`rating`, `watched`, `favorite`, `watchlist`, `watchlistAddedAt`, `favoriteRank`).
* **LogEntry**: Holds history of logged watch sessions (`watchedAt`, `rating`, `review`, `tags`, `rewatch`).

## 5. APIs and Actions
* `GET /api/movies`: Search or filter movies in the local database.
* `POST /api/movies`: Import a new movie by TMDB ID, caching its metadata.
* `PATCH /api/movies`: Modify watchlist status, rating, favorite, or ranking of a local movie.
* `GET /api/logs`: Fetch diary logs.
* `POST /api/logs`: Create a new watch log.
* `PATCH /api/logs`: Edit an existing watch log.
* `DELETE /api/logs`: Remove a log entry.

## 6. Static Data
* TMDb details are dynamic but cached.
* Standard mock arrays are minimal, used only for temporary previews or fallbacks. No large mock database file.

## 7. Authentication
* **This doc audits the pre-change baseline.** As implemented, authentication uses **NextAuth.js v5 (Auth.js)** with a Credentials provider and JWT sessions (see `src/auth.ts`, `src/auth.config.ts`, `src/middleware.ts`, and `src/app/api/auth/[...nextauth]/route.ts`). Public read routes are open; owner-only writes and `/admin/*` are gated by the session + `OWNER` role.
* **Baseline (before changes)**: there was zero authentication — anyone could access all API endpoints (`POST`, `PATCH`, `DELETE`) and modify records.

## 8. Identified Architectural Impediments
* **Global Model Pollution**: Since `Movie` stores personal fields like `watched`, `favoriteRank`, and `rating`, it is impossible to support multiple users. If User A rates a movie 5 stars, User B sees the same 5 stars.
* **Log isolation**: `LogEntry` does not contain a `userId` field, making it impossible to separate diary events by user.
* **No Authentication Guard**: Any API request directly mutates the SQLite database without checking permission.

## 9. Implementation Strategy
* Introduce the `User` model.
* Introduce the `UserMovie` model to hold user-specific interactions (`watched`, `favorite`, `favoriteRank`, `watchlist`, `watchlistAddedAt`, `rating`), separating them from the global `Movie` metadata.
* Add `userId` to `LogEntry` (making it nullable initially to allow seamless migration of existing data, then setting the owner user).
* Seed an initial owner user.
* Update all API handlers and views to resolve the owner user dynamically and scope writes and reads accordingly.
* Implement a secure HTTP-Only cookie-based login session for the owner, keeping registration private in this phase.
* Create `/roulette` choosing from the owner's library with relevant filters.
