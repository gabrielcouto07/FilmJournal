# Graph Report - Letterboxc  (2026-07-21)

## Corpus Check
- 152 files · ~83,323 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 910 nodes · 1751 edges · 60 communities (44 shown, 16 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `92565394`
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

## God Nodes (most connected - your core abstractions)
1. `getCurrentUser` - 77 edges
2. `isSameOrigin()` - 36 edges
3. `crossOriginResponse()` - 36 edges
4. `useToast()` - 33 edges
5. `scripts` - 28 edges
6. `getPosterUrl()` - 24 edges
7. `buildCanonicalLetterboxdImport()` - 17 edges
8. `userTag()` - 16 edges
9. `compilerOptions` - 16 edges
10. `ArtworkImage()` - 15 edges

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

## Communities (60 total, 16 thin omitted)

### Community 0 - "useToast"
Cohesion: 0.11
Nodes (37): GET(), DiscoverPage(), metadata, DiscoverExplorer(), Focus, FOCUS_CHIPS, PickCard(), assemblePicks() (+29 more)

### Community 1 - "import-letterboxd.ts"
Cohesion: 0.08
Nodes (45): @prisma/client, @prisma/client, createPlan(), dedupeLetterboxd(), Entry, eventTime(), groupAuthoritative(), MergeGroup (+37 more)

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
Cohesion: 0.05
Nodes (56): GET(), ALLOWED_COUNTS, errorResponse(), GET(), PoolMovie, shuffle(), toPoolMovie(), yearOf() (+48 more)

### Community 6 - "discover/route.ts"
Cohesion: 0.09
Nodes (28): errorResponse(), GET(), inter, metadata, playfair, RootLayout(), metadata, ProfilePage() (+20 more)

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
Cohesion: 0.08
Nodes (30): buildMineRound(), buildPopularRound(), fetchAndCacheCast(), POST(), roundSchema, shufflePick(), DiaryPage(), FavoritesPage() (+22 more)

### Community 23 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 24 - "TmdbError"
Cohesion: 0.10
Nodes (29): main(), backfillCollections(), rootDirectory, main(), root, describeDatabase(), exportFileNames, findMovie() (+21 more)

### Community 25 - "Validation Report - Film Journal"
Cohesion: 0.14
Nodes (17): ArtworkImage(), artworkRequests, initials(), Props, resolveArtwork(), FavoriteMovie, FavoritesManager(), CardLogInfo (+9 more)

### Community 26 - "app/page.tsx"
Cohesion: 0.54
Nodes (7): CalendarView(), dateLabel(), dateOf(), DiaryExplorer(), monthKey(), monthLabel(), View

### Community 27 - "tmdb/route.ts"
Cohesion: 0.31
Nodes (5): Props, BackgroundEnrich(), LogEditor(), Props, today()

### Community 28 - "🎬 FilmJournal"
Cohesion: 0.14
Nodes (13): 1. Clone & install, 2. Configure environment, 3. Push database schema, 4. Start dev server, Applying database migrations, Deploy to Vercel + Neon (free tier), 🎬 FilmJournal, Import Letterboxd Data Safely (+5 more)

### Community 29 - "backfill-tmdb.ts"
Cohesion: 0.11
Nodes (19): BackfillOptions, BackfillPlan, describeDatabase(), ENRICHED_WHERE, fetchDetails(), Fetched, maskHost(), MovieRef (+11 more)

### Community 30 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 31 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 32 - "LogEditor.tsx"
Cohesion: 0.07
Nodes (65): main(), resetOwnerPassword(), rootDirectory, SafeResetError, AdminPage(), metadata, POST(), schema (+57 more)

### Community 33 - "getPosterUrl"
Cohesion: 0.12
Nodes (15): LoginPage(), Tab, AuthContextType, AuthProvider(), AuthUser, useAuth(), MovieRatingControl(), ExistingMovie (+7 more)

### Community 34 - "layout.tsx"
Cohesion: 0.17
Nodes (4): RecommendationAction, TasteExplorer(), TasteData, TasteRecommendation

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
Cohesion: 0.19
Nodes (14): Answer, CastQuizGame(), Phase, posterUrl(), RoundResult, Source, SOURCES, Suggestion (+6 more)

### Community 39 - "Q: onde está a lógica de autenticação e como ela se conecta ao Prisma?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: onde está a lógica de autenticação e como ela se conecta ao Prisma?, Source Nodes

### Community 40 - "StarRating.tsx"
Cohesion: 0.11
Nodes (12): ACCENT_PRESETS, initialsOf(), Notify, ProfileSettings(), ProfileTab(), ProfileUser, Tab, TABS (+4 more)

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
Cohesion: 0.13
Nodes (16): Action, CollectionControls(), MovieResponse, Props, FavoriteToggle(), Props, KNOWN_CSVS, LetterboxdImport() (+8 more)

### Community 58 - "auth.config.ts"
Cohesion: 0.25
Nodes (3): { auth }, config, PUBLIC_PATHS

## Knowledge Gaps
- **344 isolated node(s):** `compat`, `eslintConfig`, `nextConfig`, `name`, `version` (+339 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `buildCanonicalLetterboxdImport()` connect `import-letterboxd.ts` to `TmdbError`?**
  _High betweenness centrality (0.119) - this node is a cross-community bridge._
- **Why does `@prisma/client` connect `import-letterboxd.ts` to `scripts`?**
  _High betweenness centrality (0.118) - this node is a cross-community bridge._
- **What connects `compat`, `eslintConfig`, `nextConfig` to the rest of the system?**
  _344 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `useToast` be split into smaller, more focused modules?**
  _Cohesion score 0.1109936575052854 - nodes in this community are weakly interconnected._
- **Should `import-letterboxd.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._
- **Should `app/page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07729468599033816 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.04081632653061224 - nodes in this community are weakly interconnected._