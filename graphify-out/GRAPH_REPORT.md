# Graph Report - Letterboxc  (2026-07-21)

## Corpus Check
- 152 files · ~83,323 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 910 nodes · 1699 edges · 67 communities (50 shown, 17 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9be6a939`
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
- tmdb.ts
- index.ts
- next.config.mjs
- next-env.d.ts
- postcss.config.mjs
- tailwind.config.ts
- { GET, POST }
- What You Must Do When Invoked
- TmdbError
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
- dedupe-letterboxd.ts
- PublicOverview.tsx
- validate-letterboxd.ts
- diary-dedupe.ts
- LetterboxdImport.tsx
- score/route.ts

## God Nodes (most connected - your core abstractions)
1. `getCurrentUser` - 66 edges
2. `useToast()` - 31 edges
3. `isSameOrigin()` - 30 edges
4. `crossOriginResponse()` - 30 edges
5. `scripts` - 28 edges
6. `getPosterUrl()` - 24 edges
7. `buildCanonicalLetterboxdImport()` - 17 edges
8. `userTag()` - 16 edges
9. `compilerOptions` - 16 edges
10. `ArtworkImage()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `runImport()`  [EXTRACTED]
  prisma/seed.ts → scripts/import-letterboxd.ts
- `backfillCollections()` --calls--> `ensureOwnerUser()`  [EXTRACTED]
  scripts/backfill-collections.ts → src/lib/auth.ts
- `createPlan()` --calls--> `isAuthoritativeWatch()`  [EXTRACTED]
  scripts/dedupe-letterboxd.ts → src/lib/diary-dedupe.ts
- `dedupeLetterboxd()` --calls--> `createDiaryDedupeKey()`  [EXTRACTED]
  scripts/dedupe-letterboxd.ts → src/lib/diary-dedupe.ts
- `saveMovie()` --calls--> `ensureOwnerUser()`  [EXTRACTED]
  scripts/import-letterboxd.ts → src/lib/auth.ts

## Import Cycles
- None detected.

## Communities (67 total, 17 thin omitted)

### Community 0 - "useToast"
Cohesion: 0.11
Nodes (37): GET(), DiscoverPage(), metadata, DiscoverExplorer(), Focus, FOCUS_CHIPS, PickCard(), assemblePicks() (+29 more)

### Community 1 - "import-letterboxd.ts"
Cohesion: 0.25
Nodes (15): normalizeText(), buildCanonicalLetterboxdImport(), CsvRow, day(), effectiveTime(), eventFromRow(), filmFor(), LetterboxdEvent (+7 more)

### Community 2 - "app/page.tsx"
Cohesion: 0.06
Nodes (42): DashboardPage(), metadata, DiaryItem, AXIS_LINE, AXIS_TICK, C, contrarianColor(), ContrarianScatter() (+34 more)

### Community 3 - "lib/auth.ts"
Cohesion: 0.15
Nodes (14): DatabaseReviewPage(), metadata, SEVERITY_TONE, STATUS_ICON, GET(), DatabaseReview, getDatabaseReview(), IntegrityIssue (+6 more)

### Community 4 - "scripts"
Cohesion: 0.04
Nodes (48): fflate, framer-motion, next, next-auth, dependencies, fflate, framer-motion, next (+40 more)

### Community 5 - "recommendations.ts"
Cohesion: 0.07
Nodes (40): BackfillOptions, BackfillPlan, describeDatabase(), ENRICHED_WHERE, fetchDetails(), Fetched, maskHost(), MovieRef (+32 more)

### Community 6 - "discover/route.ts"
Cohesion: 0.05
Nodes (39): errorResponse(), GET(), inter, metadata, playfair, RootLayout(), metadata, ProfilePage() (+31 more)

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
Cohesion: 0.13
Nodes (17): chooseMatch(), describeDatabase(), maskHost(), Match, MovieRef, normalize(), Outcome, printBanner() (+9 more)

### Community 12 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 13 - "tmdb.ts"
Cohesion: 0.23
Nodes (13): filesFromZip(), json(), KNOWN_FILES, knownFileFromPath(), POST(), createDiaryDedupeKey(), LetterboxdFile, LetterboxdImportValidationError (+5 more)

### Community 23 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 24 - "TmdbError"
Cohesion: 0.17
Nodes (15): main(), describeDatabase(), exportFileNames, findMovie(), ImportPlan, maskHost(), planImport(), printBanner() (+7 more)

### Community 25 - "Validation Report - Film Journal"
Cohesion: 0.18
Nodes (14): ArtworkImage(), artworkRequests, initials(), Props, resolveArtwork(), FavoriteMovie, FavoritesManager(), DetailsResponse (+6 more)

### Community 26 - "app/page.tsx"
Cohesion: 0.54
Nodes (7): CalendarView(), dateLabel(), dateOf(), DiaryExplorer(), monthKey(), monthLabel(), View

### Community 27 - "tmdb/route.ts"
Cohesion: 0.29
Nodes (9): FilmPage(), formatDate(), Props, OwnerDashboard(), BackgroundEnrich(), cleanArtworkPath(), getBackdropUrl(), movieBackdropPath() (+1 more)

### Community 28 - "🎬 FilmJournal"
Cohesion: 0.14
Nodes (13): 1. Clone & install, 2. Configure environment, 3. Push database schema, 4. Start dev server, Applying database migrations, Deploy to Vercel + Neon (free tier), 🎬 FilmJournal, Import Letterboxd Data Safely (+5 more)

### Community 29 - "backfill-tmdb.ts"
Cohesion: 0.38
Nodes (9): main(), root, saveMovie(), enrichMovieMetadata(), metadataWithoutIdentity(), missingMetadata(), getTmdbMovie(), searchTmdbMovie() (+1 more)

### Community 30 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 31 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 32 - "LogEditor.tsx"
Cohesion: 0.07
Nodes (64): backfillCollections(), rootDirectory, main(), resetOwnerPassword(), rootDirectory, SafeResetError, AdminPage(), metadata (+56 more)

### Community 33 - "getPosterUrl"
Cohesion: 0.20
Nodes (6): ExistingMovie, Feed, feeds, MovieSearch(), SearchResponse, SearchResult

### Community 34 - "layout.tsx"
Cohesion: 0.09
Nodes (24): GET(), RecommendationAction, TasteExplorer(), TastePosterCard(), archiveFingerprint(), ArchiveMovie, buildTasteData(), effectiveRating() (+16 more)

### Community 35 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 36 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 37 - "roulette/page.tsx"
Cohesion: 0.21
Nodes (11): COUNT_OPTIONS, Genre, Person, PoolMovie, randomIndex(), RoulettePage(), Source, SOURCES (+3 more)

### Community 38 - "MovieSearch.tsx"
Cohesion: 0.09
Nodes (30): guessSchema, POST(), buildMineRound(), buildPopularRound(), fetchAndCacheCast(), POST(), roundSchema, shufflePick() (+22 more)

### Community 39 - "Q: onde está a lógica de autenticação e como ela se conecta ao Prisma?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: onde está a lógica de autenticação e como ela se conecta ao Prisma?, Source Nodes

### Community 40 - "StarRating.tsx"
Cohesion: 0.14
Nodes (7): CardLogInfo, MovieCard(), Props, sizes, StarRatingProps, getDashboardData(), toCard()

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
Cohesion: 0.12
Nodes (22): LoginPage(), Tab, AuthContextType, AuthProvider(), AuthUser, useAuth(), Action, CollectionControls() (+14 more)

### Community 58 - "auth.config.ts"
Cohesion: 0.25
Nodes (3): { auth }, config, PUBLIC_PATHS

### Community 59 - "dedupe-letterboxd.ts"
Cohesion: 0.27
Nodes (10): createPlan(), dedupeLetterboxd(), Entry, eventTime(), groupAuthoritative(), MergeGroup, MoviePlan, richness() (+2 more)

### Community 60 - "PublicOverview.tsx"
Cohesion: 0.28
Nodes (8): FEATURES, getTrending(), HERO_TAGS, PublicOverview(), TrendingCard(), getTmdbFeed(), TmdbFeed, TmdbMovieSearchResult

### Community 61 - "validate-letterboxd.ts"
Cohesion: 0.29
Nodes (6): @prisma/client, @prisma/client, fixture, main(), root, LetterboxdFiles

### Community 62 - "diary-dedupe.ts"
Cohesion: 0.52
Nodes (5): createFilmIdentity(), DedupeInput, hasSource(), isAuthoritativeWatch(), normalizeTitle()

### Community 63 - "LetterboxdImport.tsx"
Cohesion: 0.40
Nodes (4): KNOWN_CSVS, LetterboxdImport(), mapCsvName(), Summary

## Knowledge Gaps
- **343 isolated node(s):** `name`, `version`, `private`, `dev`, `build` (+338 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `main()` connect `validate-letterboxd.ts` to `import-letterboxd.ts`?**
  _High betweenness centrality (0.118) - this node is a cross-community bridge._
- **Why does `buildCanonicalLetterboxdImport()` connect `import-letterboxd.ts` to `TmdbError`, `tmdb.ts`, `validate-letterboxd.ts`?**
  _High betweenness centrality (0.117) - this node is a cross-community bridge._
- **Why does `@prisma/client` connect `validate-letterboxd.ts` to `scripts`?**
  _High betweenness centrality (0.116) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _343 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `useToast` be split into smaller, more focused modules?**
  _Cohesion score 0.1109936575052854 - nodes in this community are weakly interconnected._
- **Should `app/page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06077694235588972 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.04081632653061224 - nodes in this community are weakly interconnected._