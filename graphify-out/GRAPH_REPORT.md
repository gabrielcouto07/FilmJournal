# Graph Report - Letterboxc  (2026-07-21)

## Corpus Check
- 132 files · ~69,206 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 769 nodes · 1326 edges · 67 communities (50 shown, 17 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b30d2a72`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- useToast
- import-letterboxd.ts
- app/page.tsx
- lib/auth.ts
- scripts
- recommendations.ts
- [id]/page.tsx
- compilerOptions
- devDependencies
- DiaryExplorer.tsx
- ArtworkImage.tsx
- next-auth.d.ts
- import/page.tsx
- index.ts
- next.config.mjs
- next-env.d.ts
- postcss.config.mjs
- tailwind.config.ts
- { GET, POST }
- What You Must Do When Invoked
- [id]/page.tsx
- Validation Report - Film Journal
- Part 2: Letterboxd CSV / ZIP Importer
- Current Architecture Audit - Film Journal
- 🎬 FilmJournal
- DiaryExplorer.tsx
- graphify reference: extra exports and benchmark
- graphify reference: extra exports and benchmark
- LogEditor.tsx
- getPosterUrl
- layout.tsx
- graphify reference: query, path, explain
- graphify reference: query, path, explain
- settings.ts
- Verification and Build Instructions
- Q: onde está a lógica de autenticação e como ela se conecta ao Prisma?
- ProfileSettings.tsx
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- eslint.config.mjs
- AGENTS.md
- CLAUDE.md
- .claude/CLAUDE.md
- .claude/skills/graphify/references/extraction-spec.md
- .codex/skills/graphify/references/extraction-spec.md
- useToast
- auth.config.ts
- MovieSearch.tsx
- roulette/page.tsx
- LetterboxdImport.tsx
- StarRating.tsx
- CommandPalette.tsx
- app/page.tsx

## God Nodes (most connected - your core abstractions)
1. `getCurrentUser` - 53 edges
2. `isSameOrigin()` - 26 edges
3. `crossOriginResponse()` - 26 edges
4. `scripts` - 24 edges
5. `useToast()` - 21 edges
6. `getPosterUrl()` - 18 edges
7. `buildCanonicalLetterboxdImport()` - 17 edges
8. `compilerOptions` - 16 edges
9. `userTag()` - 15 edges
10. `getUserSettings()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `runImport()`  [EXTRACTED]
  prisma/seed.ts → scripts/import-letterboxd.ts
- `backfillCollections()` --calls--> `ensureOwnerUser()`  [EXTRACTED]
  scripts/backfill-collections.ts → src/lib/auth.ts
- `saveMovie()` --calls--> `normalizeTitle()`  [EXTRACTED]
  scripts/import-letterboxd.ts → src/lib/diary-dedupe.ts
- `saveEvents()` --calls--> `createDiaryDedupeKey()`  [EXTRACTED]
  scripts/import-letterboxd.ts → src/lib/diary-dedupe.ts
- `runImport()` --calls--> `buildCanonicalLetterboxdImport()`  [EXTRACTED]
  scripts/import-letterboxd.ts → src/lib/letterboxd-import.ts

## Import Cycles
- None detected.

## Communities (67 total, 17 thin omitted)

### Community 0 - "useToast"
Cohesion: 0.15
Nodes (5): RecommendationAction, TasteExplorer(), TastePosterCard(), TasteData, TasteRecommendation

### Community 1 - "import-letterboxd.ts"
Cohesion: 0.07
Nodes (49): @prisma/client, @prisma/client, createPlan(), dedupeLetterboxd(), Entry, eventTime(), groupAuthoritative(), MergeGroup (+41 more)

### Community 2 - "app/page.tsx"
Cohesion: 0.17
Nodes (6): CardLogInfo, MovieCard(), Props, CardMovie, EnrichedMovie, UserMovieState

### Community 3 - "lib/auth.ts"
Cohesion: 0.15
Nodes (14): DatabaseReviewPage(), metadata, SEVERITY_TONE, STATUS_ICON, GET(), DatabaseReview, getDatabaseReview(), IntegrityIssue (+6 more)

### Community 4 - "scripts"
Cohesion: 0.05
Nodes (42): fflate, framer-motion, next, next-auth, dependencies, fflate, framer-motion, next (+34 more)

### Community 5 - "recommendations.ts"
Cohesion: 0.10
Nodes (30): main(), backfillCollections(), rootDirectory, main(), root, describeDatabase(), exportFileNames, findMovie() (+22 more)

### Community 6 - "[id]/page.tsx"
Cohesion: 0.19
Nodes (13): FilmPage(), formatDate(), Props, OwnerDashboard(), BackgroundEnrich(), LogEditor(), Props, today() (+5 more)

### Community 7 - "compilerOptions"
Cohesion: 0.07
Nodes (26): dom, dom.iterable, esnext, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts, **/*.tsx (+18 more)

### Community 8 - "devDependencies"
Cohesion: 0.07
Nodes (27): autoprefixer, dotenv, eslint, eslint-config-next, @eslint/eslintrc, devDependencies, autoprefixer, dotenv (+19 more)

### Community 9 - "DiaryExplorer.tsx"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 10 - "ArtworkImage.tsx"
Cohesion: 0.27
Nodes (8): ArtworkImage(), artworkRequests, initials(), Props, resolveArtwork(), DetailsResponse, Props, TmdbPoster

### Community 12 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 13 - "import/page.tsx"
Cohesion: 0.17
Nodes (12): LoginPage(), Tab, AuthContextType, AuthProvider(), AuthUser, useAuth(), Action, CollectionControls() (+4 more)

### Community 23 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 24 - "[id]/page.tsx"
Cohesion: 0.16
Nodes (12): inter, metadata, playfair, RootLayout(), metadata, ProfilePage(), PublicProfilePage(), AppProviders() (+4 more)

### Community 25 - "Validation Report - Film Journal"
Cohesion: 0.14
Nodes (13): 1. Git Repository State, 2. Executed Commands & Results, 3. Audits, Findings & Fixes, 4. Migration & Rollback Strategy, Active Changes (`git status`), Authentication Credentials, Data Verification in Prisma Studio, Git Diff Statistics (`git diff --stat`) (+5 more)

### Community 26 - "Part 2: Letterboxd CSV / ZIP Importer"
Cohesion: 0.15
Nodes (12): 1. File Upload & Processing Pipeline, 1. Schema Migration Plan, 1. User Management & Authentication Flow, 2. Isolation & Namespacing, 2. Testing Framework, 2. Validation & Security Guardrails, 3. Entity Resolution & Matching Strategy, 4. Idempotency & Transactional Integrity (+4 more)

### Community 27 - "Current Architecture Audit - Film Journal"
Cohesion: 0.18
Nodes (10): 1. Current Stack, 2. Project Structure, 3. Data Flow, 4. Current Models (Schema), 5. APIs and Actions, 6. Static Data, 7. Authentication, 8. Identified Architectural Impediments (+2 more)

### Community 28 - "🎬 FilmJournal"
Cohesion: 0.14
Nodes (13): 1. Clone & install, 2. Configure environment, 3. Push database schema, 4. Start dev server, Applying database migrations, Deploy to Vercel + Neon (free tier), 🎬 FilmJournal, Import Letterboxd Data Safely (+5 more)

### Community 29 - "DiaryExplorer.tsx"
Cohesion: 0.32
Nodes (9): DiaryPage(), CalendarView(), dateLabel(), dateOf(), DiaryExplorer(), monthKey(), monthLabel(), View (+1 more)

### Community 30 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 31 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 32 - "LogEditor.tsx"
Cohesion: 0.10
Nodes (46): main(), resetOwnerPassword(), rootDirectory, SafeResetError, AdminPage(), metadata, POST(), schema (+38 more)

### Community 33 - "getPosterUrl"
Cohesion: 0.43
Nodes (5): FavoritesPage(), FavoriteMovie, FavoritesManager(), getFavoritesData(), getPosterUrl()

### Community 34 - "layout.tsx"
Cohesion: 0.06
Nodes (52): ALLOWED_COUNTS, errorResponse(), GET(), PoolMovie, shuffle(), toPoolMovie(), yearOf(), GET() (+44 more)

### Community 35 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 36 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 37 - "settings.ts"
Cohesion: 0.21
Nodes (12): apply(), resolveTheme(), SettingsContext, SettingsContextValue, SettingsProvider(), AppSettings, DEFAULT_SETTINGS, LANDING_PAGES (+4 more)

### Community 38 - "Verification and Build Instructions"
Cohesion: 0.33
Nodes (5): 1. Run Schema Updates & Client Generation, 2. Run Data Migration Script, 3. Run Validation Commands, 4. Verify Database in Prisma Studio, Verification and Build Instructions

### Community 39 - "Q: onde está a lógica de autenticação e como ela se conecta ao Prisma?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: onde está a lógica de autenticação e como ela se conecta ao Prisma?, Source Nodes

### Community 40 - "ProfileSettings.tsx"
Cohesion: 0.14
Nodes (7): ACCENT_PRESETS, initialsOf(), Notify, ProfileTab(), ProfileUser, Tab, TABS

### Community 41 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 42 - "graphify reference: commit hook and native CLAUDE.md integration"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 43 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 44 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 45 - "graphify reference: commit hook and native CLAUDE.md integration"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 46 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 57 - "useToast"
Cohesion: 0.21
Nodes (10): FavoriteToggle(), Props, MovieRatingControl(), ShareProfileButton(), Toast, ToastContext, ToastContextValue, ToastProvider() (+2 more)

### Community 58 - "auth.config.ts"
Cohesion: 0.25
Nodes (3): { auth }, config, PUBLIC_PATHS

### Community 59 - "MovieSearch.tsx"
Cohesion: 0.18
Nodes (5): ExistingMovie, Feed, feeds, SearchResponse, SearchResult

### Community 60 - "roulette/page.tsx"
Cohesion: 0.27
Nodes (9): COUNT_OPTIONS, Genre, Person, PoolMovie, randomIndex(), RoulettePage(), tmdbImage(), WinnerDetail (+1 more)

### Community 61 - "LetterboxdImport.tsx"
Cohesion: 0.40
Nodes (4): KNOWN_CSVS, LetterboxdImport(), mapCsvName(), Summary

### Community 62 - "StarRating.tsx"
Cohesion: 0.40
Nodes (4): useSettings(), sizes, StarRating(), StarRatingProps

### Community 66 - "app/page.tsx"
Cohesion: 0.18
Nodes (14): StatsPage(), WatchlistPage(), DiaryItem, WatchlistExplorer(), WatchlistMovie, countValues(), DashboardData, DiaryData (+6 more)

## Knowledge Gaps
- **322 isolated node(s):** `Genre`, `Person`, `PoolMovie`, `WinnerDetail`, `COUNT_OPTIONS` (+317 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `buildCanonicalLetterboxdImport()` connect `import-letterboxd.ts` to `recommendations.ts`?**
  _High betweenness centrality (0.105) - this node is a cross-community bridge._
- **Why does `dependencies` connect `scripts` to `import-letterboxd.ts`?**
  _High betweenness centrality (0.103) - this node is a cross-community bridge._
- **What connects `Genre`, `Person`, `PoolMovie` to the rest of the system?**
  _322 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `import-letterboxd.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07259528130671507 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.046511627906976744 - nodes in this community are weakly interconnected._
- **Should `recommendations.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0990990990990991 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.07407407407407407 - nodes in this community are weakly interconnected._