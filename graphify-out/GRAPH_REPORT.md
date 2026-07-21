# Graph Report - Letterboxc  (2026-07-21)

## Corpus Check
- 140 files · ~77,566 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 857 nodes · 1594 edges · 64 communities (48 shown, 16 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.56)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ce226249`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- useToast
- import-letterboxd.ts
- app/page.tsx
- lib/auth.ts
- scripts
- recommendations.ts
- discover/route.ts
- compilerOptions
- devDependencies
- DiaryExplorer.tsx
- TmdbError
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
- app/page.tsx
- tmdb/route.ts
- 🎬 FilmJournal
- backfill-tmdb.ts
- graphify reference: extra exports and benchmark
- graphify reference: extra exports and benchmark
- LogEditor.tsx
- getPosterUrl
- layout.tsx
- graphify reference: query, path, explain
- graphify reference: query, path, explain
- roulette/page.tsx
- MovieSearch.tsx
- Q: onde está a lógica de autenticação e como ela se conecta ao Prisma?
- StarRating.tsx
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
- LetterboxdImport.tsx
- auth.config.ts
- ToastProvider.tsx
- WatchlistExplorer.tsx
- package.json
- middleware.ts

## God Nodes (most connected - your core abstractions)
1. `getCurrentUser` - 61 edges
2. `useToast()` - 31 edges
3. `scripts` - 28 edges
4. `isSameOrigin()` - 28 edges
5. `crossOriginResponse()` - 28 edges
6. `getPosterUrl()` - 24 edges
7. `buildCanonicalLetterboxdImport()` - 17 edges
8. `userTag()` - 16 edges
9. `compilerOptions` - 16 edges
10. `useAuth()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `runImport()`  [EXTRACTED]
  prisma/seed.ts → scripts/import-letterboxd.ts
- `backfillCollections()` --calls--> `ensureOwnerUser()`  [EXTRACTED]
  scripts/backfill-collections.ts → src/lib/auth.ts
- `main()` --calls--> `toMovieMetadata()`  [EXTRACTED]
  scripts/backfill-metadata.ts → src/lib/tmdb.ts
- `fetchDetails()` --calls--> `getTmdbMovieForBackfill()`  [EXTRACTED]
  scripts/backfill-tmdb.ts → src/lib/tmdb.ts
- `saveMovie()` --calls--> `ensureOwnerUser()`  [EXTRACTED]
  scripts/import-letterboxd.ts → src/lib/auth.ts

## Import Cycles
- None detected.

## Communities (64 total, 16 thin omitted)

### Community 0 - "useToast"
Cohesion: 0.12
Nodes (32): GET(), DiscoverPage(), metadata, DiscoverExplorer(), Focus, FOCUS_CHIPS, PickCard(), assemblePicks() (+24 more)

### Community 1 - "import-letterboxd.ts"
Cohesion: 0.05
Nodes (64): @prisma/client, @prisma/client, main(), createPlan(), dedupeLetterboxd(), Entry, eventTime(), groupAuthoritative() (+56 more)

### Community 2 - "app/page.tsx"
Cohesion: 0.08
Nodes (33): DashboardPage(), metadata, AXIS_LINE, AXIS_TICK, C, contrarianColor(), ContrarianScatter(), COUNTRY_NAMES (+25 more)

### Community 3 - "lib/auth.ts"
Cohesion: 0.15
Nodes (14): DatabaseReviewPage(), metadata, SEVERITY_TONE, STATUS_ICON, GET(), DatabaseReview, getDatabaseReview(), IntegrityIssue (+6 more)

### Community 4 - "scripts"
Cohesion: 0.04
Nodes (48): fflate, framer-motion, next, next-auth, dependencies, fflate, framer-motion, next (+40 more)

### Community 5 - "recommendations.ts"
Cohesion: 0.06
Nodes (51): main(), root, saveMovie(), chooseMatch(), describeDatabase(), maskHost(), Match, MovieRef (+43 more)

### Community 6 - "discover/route.ts"
Cohesion: 0.13
Nodes (16): inter, metadata, playfair, RootLayout(), metadata, ProfilePage(), AppProviders(), PageTransition() (+8 more)

### Community 7 - "compilerOptions"
Cohesion: 0.07
Nodes (26): dom, dom.iterable, esnext, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts, **/*.tsx (+18 more)

### Community 8 - "devDependencies"
Cohesion: 0.07
Nodes (27): autoprefixer, dotenv, eslint, eslint-config-next, @eslint/eslintrc, devDependencies, autoprefixer, dotenv (+19 more)

### Community 9 - "DiaryExplorer.tsx"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 10 - "TmdbError"
Cohesion: 0.24
Nodes (8): Result, apply(), resolveTheme(), SettingsContext, SettingsContextValue, SettingsProvider(), AppSettings, DEFAULT_SETTINGS

### Community 12 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 13 - "import/page.tsx"
Cohesion: 0.16
Nodes (13): Action, CollectionControls(), MovieResponse, Props, FavoriteToggle(), Props, MovieRatingControl(), Toast (+5 more)

### Community 23 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 24 - "[id]/page.tsx"
Cohesion: 0.15
Nodes (7): ACCENT_PRESETS, initialsOf(), Notify, ProfileTab(), ProfileUser, Tab, TABS

### Community 25 - "Validation Report - Film Journal"
Cohesion: 0.23
Nodes (10): ArtworkImage(), artworkRequests, initials(), Props, resolveArtwork(), FEATURES, getTrending(), HERO_TAGS (+2 more)

### Community 26 - "app/page.tsx"
Cohesion: 0.28
Nodes (10): DiaryPage(), CalendarView(), dateLabel(), dateOf(), DiaryExplorer(), DiaryItem, monthKey(), monthLabel() (+2 more)

### Community 27 - "tmdb/route.ts"
Cohesion: 0.20
Nodes (11): FilmPage(), formatDate(), Props, BackgroundEnrich(), DetailsResponse, PosterPicker(), Props, cleanArtworkPath() (+3 more)

### Community 28 - "🎬 FilmJournal"
Cohesion: 0.14
Nodes (13): 1. Clone & install, 2. Configure environment, 3. Push database schema, 4. Start dev server, Applying database migrations, Deploy to Vercel + Neon (free tier), 🎬 FilmJournal, Import Letterboxd Data Safely (+5 more)

### Community 29 - "backfill-tmdb.ts"
Cohesion: 0.11
Nodes (18): BackfillOptions, BackfillPlan, describeDatabase(), ENRICHED_WHERE, fetchDetails(), Fetched, maskHost(), MovieRef (+10 more)

### Community 30 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 31 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 32 - "LogEditor.tsx"
Cohesion: 0.07
Nodes (59): backfillCollections(), rootDirectory, main(), resetOwnerPassword(), rootDirectory, SafeResetError, AdminPage(), metadata (+51 more)

### Community 33 - "getPosterUrl"
Cohesion: 0.20
Nodes (11): LoginPage(), Tab, AuthContextType, AuthProvider(), AuthUser, useAuth(), LogEditor(), Props (+3 more)

### Community 34 - "layout.tsx"
Cohesion: 0.09
Nodes (24): StatsPage(), RecommendationAction, TasteExplorer(), TastePosterCard(), archiveFingerprint(), ArchiveMovie, buildTasteData(), effectiveRating() (+16 more)

### Community 35 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 36 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 37 - "roulette/page.tsx"
Cohesion: 0.27
Nodes (9): COUNT_OPTIONS, Genre, Person, PoolMovie, randomIndex(), RoulettePage(), tmdbImage(), WinnerDetail (+1 more)

### Community 38 - "MovieSearch.tsx"
Cohesion: 0.18
Nodes (7): ExistingMovie, Feed, feeds, MovieSearch(), ResultCard(), SearchResponse, SearchResult

### Community 39 - "Q: onde está a lógica de autenticação e como ela se conecta ao Prisma?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: onde está a lógica de autenticação e como ela se conecta ao Prisma?, Source Nodes

### Community 40 - "StarRating.tsx"
Cohesion: 0.40
Nodes (4): useSettings(), sizes, StarRating(), StarRatingProps

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

### Community 57 - "LetterboxdImport.tsx"
Cohesion: 0.40
Nodes (4): KNOWN_CSVS, LetterboxdImport(), mapCsvName(), Summary

### Community 58 - "auth.config.ts"
Cohesion: 0.25
Nodes (3): { auth }, config, PUBLIC_PATHS

### Community 59 - "ToastProvider.tsx"
Cohesion: 0.28
Nodes (3): OwnerDashboard(), getDashboardData(), movieBackdropPath()

### Community 60 - "WatchlistExplorer.tsx"
Cohesion: 0.20
Nodes (12): WatchlistPage(), WatchlistExplorer(), WatchlistMovie, Palate, countValues(), DashboardData, DiaryData, getStatsData() (+4 more)

### Community 61 - "package.json"
Cohesion: 0.29
Nodes (6): CardLogInfo, MovieCard(), Props, CardMovie, EnrichedMovie, UserMovieState

### Community 62 - "middleware.ts"
Cohesion: 0.43
Nodes (5): FavoritesPage(), FavoriteMovie, FavoritesManager(), getFavoritesData(), getPosterUrl()

## Knowledge Gaps
- **328 isolated node(s):** `compat`, `eslintConfig`, `nextConfig`, `name`, `version` (+323 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@prisma/client` connect `import-letterboxd.ts` to `scripts`?**
  _High betweenness centrality (0.121) - this node is a cross-community bridge._
- **What connects `compat`, `eslintConfig`, `nextConfig` to the rest of the system?**
  _328 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `useToast` be split into smaller, more focused modules?**
  _Cohesion score 0.12280701754385964 - nodes in this community are weakly interconnected._
- **Should `import-letterboxd.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05468215994531784 - nodes in this community are weakly interconnected._
- **Should `app/page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07729468599033816 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.04081632653061224 - nodes in this community are weakly interconnected._
- **Should `recommendations.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0597567424643046 - nodes in this community are weakly interconnected._