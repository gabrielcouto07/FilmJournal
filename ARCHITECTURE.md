# FilmJournal — Technical Guide

Developer-facing companion to the [README](README.md). The README is the pt-BR
product tour; this document is the map of the code: how it's laid out, the
patterns you'll see repeated, how the database and TMDB integration work, how
the game is wired, and the sharp edges worth knowing before you touch it.

Code comments and identifiers are in English; user-facing copy is pt-BR. This
guide follows the code's language.

---

## 1. Stack & runtime

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 15** (App Router) | Server Components by default; route handlers for the API |
| Language | **TypeScript 5** (strict) | `npm run typecheck` = `tsc --noEmit` |
| UI | **React 19** + **Tailwind CSS 3** | `framer-motion` for animation, `recharts` for charts |
| ORM | **Prisma 6** | PostgreSQL provider, pooled + direct URLs |
| Auth | **NextAuth v5 beta** | Credentials provider, JWT session strategy |
| Validation | **zod** | Every mutating route validates its body |
| Data source | **TMDB API** | One shared fetch shape (see §7) |
| Runtime | **Node 20+** | Node crypto used for password hashing + round tokens |

There is one first-class user (the "owner"); the data model is multi-user ready
(`User`, per-user scoping everywhere) but the product is single-tenant by design.

---

## 2. Directory map

```
src/
├── app/                      # Next.js App Router — pages + API
│   ├── page.tsx              # "/" — taste-first home (hero verdict + dashboards)
│   ├── layout.tsx            # root layout: fonts, providers, header, theme
│   ├── loading.tsx           # route-level skeleton for "/"
│   ├── diary/ favorites/ watchlist/ discover/ roulette/ play/ search/ profile/
│   ├── film/[id]/            # single-film page
│   ├── welcome/              # first-run onboarding flow
│   ├── login/                # credentials sign-in
│   ├── admin/                # owner-only DB review tools
│   └── api/                  # route handlers (see §6)
│       ├── auth/[...nextauth]/  register/
│       ├── movies/  logs/  discover/  roulette/  play/  account/  settings/  …
├── components/               # client + server components (see §5)
│   ├── dashboard/            # TasteDashboard (the Paladar sections)
│   ├── palate/               # PalateCharts, EvolutionCharts (Recharts)
│   ├── discover/             # DiscoverExplorer
│   └── play/                 # HybridGame (Cine-Detetive)
├── lib/                      # non-UI logic
│   ├── analytics/            # PURE modules: palate, timeline, motifs, blindspots, verdict
│   ├── play/                 # PURE hybrid.ts + AES-sealed token.ts
│   ├── data.ts               # cached per-user read layer (Prisma → view models)
│   ├── recommendations.ts    # taste-based TMDB recommendations (cached)
│   ├── discover.ts           # blind-spot data layer (uncached by design)
│   ├── tmdb.ts               # the single TMDB client
│   ├── movie-metadata.ts     # shared enrichment (film add, backfill, on-demand)
│   ├── auth.ts  password.ts  security.ts  rate-limit.ts  settings.ts  prisma.ts
│   └── letterboxd-*.ts  diary-dedupe.ts  onboarding.ts  db-review.ts
├── auth.ts                   # NextAuth config (providers, callbacks)
└── auth.config.ts            # edge-safe auth config (used by middleware)

prisma/
├── schema.prisma             # the data model (see §8)
└── migrations/               # 10 additive migrations, timestamp-prefixed

scripts/                      # tsx CLIs: import, backfill, dedupe, perf, smoke
tests/                        # node:test suites, one per pure module
graphify-out/                 # knowledge graph artifact (see §12)
```

---

## 3. The three-layer architecture

The single most important convention. Every feature is split into three layers,
and the boundaries are strict:

```
┌─────────────────────────────────────────────────────────────┐
│  PAGES / COMPONENTS            render only — no math, no SQL  │
│  src/app/**/page.tsx, src/components/**                       │
└───────────────▲─────────────────────────────────────────────┘
                │ view models (JSON-safe, pre-aggregated)
┌───────────────┴─────────────────────────────────────────────┐
│  DATA LAYER                    Prisma reads + caching         │
│  src/lib/data.ts, recommendations.ts, discover.ts             │
└───────────────▲─────────────────────────────────────────────┘
                │ plain arrays/objects (PalateFilm[], TimelineEntry[]…)
┌───────────────┴─────────────────────────────────────────────┐
│  PURE MODULES                  all the analytics math         │
│  src/lib/analytics/*, src/lib/play/hybrid.ts                  │
│  no I/O · no Prisma · no fetch · 100% unit-tested             │
└─────────────────────────────────────────────────────────────┘
```

**Why it matters:** the pure layer is where every non-trivial decision lives
(what makes a film "contrarian", how a guess is graded, how a verdict sentence
is assembled), and because it never touches I/O it is exhaustively testable with
plain fixtures. If you're adding analytics, the math goes in a pure module with
a test; the data layer only shapes Prisma rows into that module's input type.

**Do not** put a Prisma query inside a component, or business logic inside
`data.ts`. That separation is what keeps the test suite meaningful.

---

## 4. Rendering & data-fetching model

- **Server Components by default.** Pages are `async` server components that
  call the data layer directly and pass view models down. Client interactivity
  is isolated into `"use client"` islands (charts, the game, forms, the header).
- **`export const dynamic = "force-dynamic"`** on pages that must reflect the
  logged-in user on every request (e.g. `/discover`, `/play`, `/film/[id]`).
- **Caching lives in the data layer, not the page.** `src/lib/data.ts` wraps
  each read in `unstable_cache` with two tags — `user:{id}` and `catalog` — and
  a 300s revalidate safety net:

  ```ts
  return unstable_cache(
    async () => { /* Prisma work → view model */ },
    ["stats-v2", userId],                                  // cache key parts
    { revalidate: 300, tags: [userTag(userId), CATALOG_TAG] },
  )();
  ```

  Mutating routes call `revalidateTag("user:{id}")` or `revalidateTag("catalog")`
  so navigation is served from cache but a write is reflected immediately. The
  data layer logs `[data] <name> HIT|MISS <ms>` so cache health is observable in
  the server console.
- **`recommendations.ts`** is cached on a computed *fingerprint* (movie/log
  counts + latest-updated timestamps) so it recomputes only when the archive
  actually changed. **`discover.ts` is intentionally uncached** — picks depend
  on dismissals and live TMDB responses (which `tmdb.ts` already HTTP-caches
  ~6h), and `/discover` is `force-dynamic`.

---

## 5. Components

Presentation only. Notable ones:

- `dashboard/TasteDashboard.tsx` — the Paladar sections (stats, consensus,
  motifs, evolution, taste maps). Rendered below the hero verdict on `/`.
- `palate/PalateCharts.tsx`, `palate/EvolutionCharts.tsx` — Recharts leaves.
  Charts pass `isAnimationActive={false}` and are stateless, so they need no
  memoization (props arrive as fresh RSC objects each navigation).
- `play/HybridGame.tsx` — the whole Cine-Detetive client (see §9).
- `SiteHeader.tsx` — nav; the "Mais" dropdown's click-away layer is a
  `role="presentation"` div (see §11, a11y).
- Providers (`AppProviders`, `AuthProvider`, `SettingsProvider`, `ToastProvider`)
  wrap the tree in `layout.tsx`.

---

## 6. API routes

All under `src/app/api/**/route.ts`. Conventions shared by every mutating route:

1. `if (!isSameOrigin(request)) return crossOriginResponse();` — CSRF guard.
2. `const user = await getCurrentUser();` then 401 if absent.
3. Parse the body with a **zod** schema; 400 on failure.
4. Do the work; `revalidateTag(...)` if it changed cached data.

| Group | Routes | Purpose |
|---|---|---|
| Auth | `auth/[...nextauth]`, `auth/register` | NextAuth handler + owner registration |
| Movies | `movies`, `movies/enrich`, `movies/artwork` | add/update film, background enrichment, poster picker |
| Diary | `logs` | create/update/delete diary entries |
| Discover | `discover`, `discover/dismiss` | blind-spot picks + "not interested" |
| Roulette | `roulette/discover`, `roulette/genres`, `roulette/people`, `roulette/prefs` | pool building + persisted filters |
| Play | `play/round`, `play/guess`, `play/search`, `play/score` | the game loop (see §9) |
| Account | `account`, `account/email`, `account/password`, `profile`, `settings` | profile + preferences |
| Import | `import/letterboxd` | ZIP/CSV import endpoint |
| Admin | `admin/db-review` | owner-only DB sanity report |

---

## 7. TMDB integration

**One client, one fetch shape.** `src/lib/tmdb.ts` is the only place that talks
to TMDB. `getTmdbMovie(id)` appends `credits,keywords,external_ids` in a single
request, so cast, director, genres, keywords, countries and language all arrive
together. Enrichment paths (film add, on-demand `movies/enrich`, the backfill
script, and the game) **all reuse this shape** — do not add a parallel fetch
path; keeping one shape is what stops the enrichment fields from drifting apart.

- **HTTP caching:** non-refresh calls use `next: { revalidate: 21600 }` (6h);
  a 12s `AbortSignal.timeout` bounds hangs.
- **Error model:** all failures throw `TmdbError(message, status)`. 401→503,
  404→404, 429→429, everything else→502 (the message now carries the upstream
  status for debugging).
- **Enrichment sentinel:** `Movie.originalLanguage` doubles as the
  "fully enriched" marker — TMDB returns it for every valid movie, so a film
  that has it also had its relational fields (genres, keywords, director,
  countries) written. `missingMetadata()` in `movie-metadata.ts` uses this.

---

## 8. Database

PostgreSQL via Prisma. Two connection strings (both required):

- **`DATABASE_URL`** — the *pooled* connection (PgBouncer on Neon). Append
  `?pgbouncer=true&connection_limit=1` in serverless so each function instance
  holds a single pooled connection. This is what the app uses at runtime.
- **`DIRECT_URL`** — the *direct*, non-pooled connection. Used **only** by
  `prisma migrate deploy` and schema operations, which can't run through a pooler.

`src/lib/prisma.ts` exports a singleton client (cached on `globalThis` in dev to
survive HMR).

### Schema at a glance

| Model | Key fields | Role |
|---|---|---|
| **Movie** | `tmdbId?` unique, `title`, `year`, poster/backdrop paths, `genres`/`directors` (denormalized strings), `directorId/Name`, `cast`, `tmdbRating`, `countries[]`, `originalLanguage` | Shared film catalog. `genreList`/`keywords` are the relational (M2M) truth; the string columns are legacy/denormalized reads. |
| **Genre**, **Keyword** | `id` = TMDB id, `name` | TMDB taxonomies, M2M to Movie. Keywords drive the "motifs" analysis. |
| **User** | `username`/`email` unique, `passwordHash`, `role` | Accounts. `role="OWNER"` is the primary user. |
| **UserMovie** | PK `[userId, movieId]`; `watched`, `favorite`, `favoriteRank?`, `watchlist`, `rating?` | Per-user relationship to a film. This is the "my library" join. |
| **LogEntry** | `sourceKey` unique, `dedupeKey?` unique, `watchedAt`/`loggedAt`, `rating`, `review`, `rewatch` | The diary time-series. `dedupeKey` (movie + effective watch day + same-day occurrence) is the idempotency key for imports. |
| **UserSettings** | `theme`, `accentColor`, `language`, `defaultLandingPage`, `rouletteFilters` (Json), `onboardedAt?` | Per-user preferences. `onboardedAt=null` means the `/welcome` flow hasn't run. |
| **GameScore** | PK `[userId, game, source]`; `bestScore`, `bestRounds` | Best score per mode. `game="hybrid"` (Cine-Detetive); `source ∈ {mine, popular, daily}`. Free-string keys → new game modes need no migration. |
| **BlindSpotDismissal** | PK `[userId, dimension, gapKey]` | "Not interested" signals; `gapKey="*"` mutes a whole dimension. |
| **RateLimit** | `key` PK, `count`, `resetAt` | DB-backed rate limiting that survives serverless cold starts. Keys like `register:{ip}`, `pwd:{userId}`. |

### Migrations

Ten migrations in `prisma/migrations/`, timestamp-prefixed
(`20260721000000_init` → `20260721200000_add_onboarding_flag`).

**The one rule: migrations are additive.** Never drop a column that holds data.
A new app version must never destroy someone's history. This is why a couple of
columns are intentionally *orphaned* rather than removed — see §11.

- Dev: `npm run db:push` syncs the schema directly (no migration file).
- Prod: `npm run db:migrate` (`prisma migrate deploy`) applies the folder.
- Adopting migrations on a DB first created with `db push`:
  `prisma migrate resolve --applied 20260721000000_init` once, then deploy.

---

## 9. The game — Cine-Detetive

A Spotle-style deduction game. All rules live in the **pure** module
`src/lib/play/hybrid.ts` (tested in `tests/play-hybrid.test.ts`); the API routes
are thin I/O around it.

**Stateless, sealed rounds.** The server never stores a round. `play/round`
builds the target's full grading profile and seals it into an AES-256-GCM token
(`src/lib/play/token.ts`, key derived from `NEXTAUTH_SECRET`). The client holds
the token; the answer never sits in a readable payload. Each `play/guess` call
opens the token, grades, and returns only the clues that guess is entitled to.

**Reveal schedule** (`actorsVisible`, `posterStage`, `hintUnlocked`):

| Guess | Unlocks |
|---|---|
| 1–4 | one cast member each, least-billed → toward the lead |
| 5 | hint 1 (keywords) available; cast pauses |
| 6 | the top-billed actor |
| 7 / 8 / 9 | poster enters, blur **heavy → medium → light** |
| 8 | hint 2 (tagline) available |
| 10 | last guess |

**Tile grading** (`gradeGuess` → six tiles, each `exact | close | miss`):

| Tile | exact 🟩 | close 🟨 | miss ⬜ |
|---|---|---|---|
| Year | same year | within ±5 (arrow toward target) | beyond |
| Genres | identical set | ≥1 shared | none |
| Director | same person id (name fallback) | — | different |
| Studio | same primary company | any shared company | none |
| Rating | within ±0.3 | within ±1.0 (arrow) | beyond |
| Cast | ≥3 shared over top-10 pools | 1–2 shared (names shown) | none |

**Scoring** (`computeHybridScore`): `1000 − (guesses−1)·100 + 50·(unused hints)`;
a loss is 0. **Modes:** `mine` (your films), `popular` (TMDB feed), and `daily`
— a deterministic FNV-1a hash of the UTC date (`dailyKey`/`dailySeed`) picks a
stable page+index in TMDB top-rated, so everyone gets the same movie all day.

---

## 10. Analytics pure modules

Each is `data in → data out`, no I/O, one test file:

| Module | Produces |
|---|---|
| `palate.ts` | contrarian analysis (you vs. the crowd), decade/country/genre/runtime distributions, director loyalty |
| `timeline.ts` | per-year rating/lean/era/genre-share series + auto-generated pt-BR "biggest shift" sentences |
| `motifs.ts` | recurring TMDB keywords across highly-rated films, one evocative sentence (stoplist filters generic tags) |
| `verdict.ts` | the home-page hero sentence, assembled from palate signals; three voices behind `DEFAULT_VOICE`; thin-data fallback below 10 rated films |
| `blindspots.ts` | coverage → gaps → acclaimed candidates per gap, with data-derived rationale |

Scales/units convention: **user ratings are 0–5** (half-stars); the crowd rating
is TMDB `vote_average` on **0–10**, normalized to 0–5 (÷2) before any comparison.

---

## 11. Known bugs, quirks & gotchas

Things that will bite if you don't know them:

- **`npm run dev` is slow on first hit per route (~2–20s).** That's Next.js
  compiling each route on demand — it does **not** exist in production. Measured
  prod navigation is 70–360ms warm. Never profile against `dev`; use
  `npm run build && npm start` (see `scripts/perf-measure.mjs`).
- **Windows: killing the dev/prod server orphans the Node child holding the
  port.** `npm run dev/start` spawns a child that keeps `:3000`. If you get
  `EADDRINUSE`, kill the listener PID from `netstat -ano | grep :3000`, not just
  the npm task.
- **Background enrichment has a cooldown.** `<BackgroundEnrich/>` fires
  `movies/enrich` after paint. Some movies can never be completed (unreleased
  films with no TMDB poster/credits yet, transient TMDB 5xx). A per-process 6h
  no-change cooldown stops it re-hammering them every navigation. Restarting the
  process resets the cooldown (it's in-memory, not persisted).
- **Orphaned-by-design DB columns.** `UserSettings.profileVisibility` (public
  profiles were removed) and denormalized `Movie.genres`/`directors` strings
  (superseded by the relational `genreList`/`keywords`) are kept, not dropped —
  the additive-migration rule. Don't "clean them up".
- **`/diary` ships a large HTML document** (all entries serialized for
  client-side filtering). Fine on the server (~300ms) but the heaviest page to
  hydrate; it's why `/diary` in dev feels slowest.
- **a11y — the fixed bug:** a click-away backdrop must not be a focusable
  element with `aria-hidden` (Chrome blocks aria-hidden on a focused ancestor).
  `SiteHeader`'s backdrop is a `role="presentation"` div; genuinely
  non-interactive overlays in the game use `inert`. Follow that pattern.
- **CRLF warnings on commit** are expected on Windows (`LF will be replaced by
  CRLF`); harmless.
- **`.env` vs `.env.local`.** Next reads `.env.local`; some Prisma invocations
  read only `.env`. The repo keeps both in sync locally. Both are gitignored.

---

## 12. Testing & tooling

- **Tests:** `npm test` runs `node --import tsx --test` over `tests/*.test.ts`
  (8 suites, 71 tests). Every pure module has a suite. **New pure modules must
  add their test file to the `test` script in `package.json`** — the list is
  explicit, not a glob.
- **Smoke tests:** `scripts/smoke-hybrid.mjs` plays a real game round through the
  live API (start the app first). `perf-measure.mjs` / `perf-enrich.mjs` time
  routes and the enrich sweep.
- **Typecheck / lint:** `npm run typecheck`, `npm run lint`.
- **Knowledge graph:** `graphify-out/` holds an AST-derived graph of the repo.
  Query it with `graphify query "<question>"` before spelunking source. Refresh
  after changes with `graphify update .` (AST-only, no API cost).

---

## 13. Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | Pooled Postgres connection (runtime) |
| `DIRECT_URL` | ✅ | Direct Postgres connection (migrations only) |
| `NEXTAUTH_URL` | ✅ | App origin (`http://localhost:3000` locally) |
| `NEXTAUTH_SECRET` | ✅ | JWT signing **and** the game token key (`openssl rand -base64 32`) |
| `TMDB_API_KEY` | ✅ | TMDB API key |
| `APP_OWNER_USERNAME` | ✅ | Owner account username |
| `APP_OWNER_PASSWORD` | first run | Owner bootstrap password; removable after the account exists |
| `BLOB_READ_WRITE_TOKEN` | — | Future: Vercel Blob for avatar uploads |
| `KV_REST_API_URL` / `_TOKEN` | — | Future: swap the DB rate limiter for KV/Upstash |

---

## 14. Security model (summary)

- Passwords hashed with **scrypt** (`src/lib/password.ts`), never stored plain.
- **Rate limiting** is DB-backed (`RateLimit` table) so it survives serverless
  cold starts — registration is limited per IP, sensitive actions per user.
- **CSRF:** mutating routes call `isSameOrigin()` — a mismatched `Origin` header
  (a foreign page driving the request with the victim's cookie) is rejected 403.
- **Re-auth on sensitive actions** (email/password change) requires the current
  password.
- **Private by design:** no public profiles, no feed. Every read is scoped to
  the authenticated `userId`.
