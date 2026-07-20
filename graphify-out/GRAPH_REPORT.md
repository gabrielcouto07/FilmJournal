# Graph Report - Letterboxc  (2026-07-20)

## Corpus Check
- 107 files · ~59,689 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 681 nodes · 1028 edges · 61 communities (42 shown, 19 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `34ed4b67`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- useToast
- import-letterboxd.ts
- tmdb.ts
- lib/auth.ts
- scripts
- recommendations.ts
- getPosterUrl
- compilerOptions
- devDependencies
- DiaryExplorer.tsx
- roulette/page.tsx
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
- roulette/page.tsx
- graphify reference: extra exports and benchmark
- graphify reference: extra exports and benchmark
- LogEditor.tsx
- useAuth
- layout.tsx
- graphify reference: query, path, explain
- graphify reference: query, path, explain
- StarRating.tsx
- Verification and Build Instructions
- Q: onde está a lógica de autenticação e como ela se conecta ao Prisma?
- dedupe-letterboxd.ts
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
- app/page.tsx
- auth.config.ts
- logs/route.ts
- admin/page.tsx

## God Nodes (most connected - your core abstractions)
1. `getCurrentUser()` - 29 edges
2. `useToast()` - 25 edges
3. `scripts` - 24 edges
4. `getPosterUrl()` - 20 edges
5. `buildCanonicalLetterboxdImport()` - 17 edges
6. `compilerOptions` - 16 edges
7. `ArtworkImage()` - 12 edges
8. `What You Must Do When Invoked` - 12 edges
9. `What You Must Do When Invoked` - 12 edges
10. `useAuth()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `main()` --references--> `@prisma/client`  [EXTRACTED]
  scripts/validate-letterboxd.ts → package.json
- `main()` --calls--> `runImport()`  [EXTRACTED]
  prisma/seed.ts → scripts/import-letterboxd.ts
- `backfillCollections()` --calls--> `ensureOwnerUser()`  [EXTRACTED]
  scripts/backfill-collections.ts → src/lib/auth.ts
- `dedupeLetterboxd()` --calls--> `createDiaryDedupeKey()`  [EXTRACTED]
  scripts/dedupe-letterboxd.ts → src/lib/diary-dedupe.ts
- `saveMovie()` --calls--> `ensureOwnerUser()`  [EXTRACTED]
  scripts/import-letterboxd.ts → src/lib/auth.ts

## Import Cycles
- None detected.

## Communities (61 total, 19 thin omitted)

### Community 0 - "useToast"
Cohesion: 0.32
Nodes (9): DiaryPage(), CalendarView(), dateLabel(), dateOf(), DiaryExplorer(), DiaryItem, monthKey(), monthLabel() (+1 more)

### Community 1 - "import-letterboxd.ts"
Cohesion: 0.07
Nodes (51): main(), describeDatabase(), exportFileNames, findMovie(), ImportPlan, maskHost(), planImport(), printBanner() (+43 more)

### Community 2 - "tmdb.ts"
Cohesion: 0.06
Nodes (52): main(), root, CollectionMutation, GET(), PATCH(), POST(), setFavoriteRank(), ALLOWED_COUNTS (+44 more)

### Community 3 - "lib/auth.ts"
Cohesion: 0.07
Nodes (40): backfillCollections(), rootDirectory, main(), resetOwnerPassword(), rootDirectory, SafeResetError, DatabaseReviewPage(), metadata (+32 more)

### Community 4 - "scripts"
Cohesion: 0.04
Nodes (44): fflate, framer-motion, next, next-auth, dependencies, fflate, framer-motion, next (+36 more)

### Community 5 - "recommendations.ts"
Cohesion: 0.16
Nodes (9): FavoritesPage(), FavoriteMovie, FavoritesManager(), MovieCard(), ResultCard(), RecommendationAction, TasteExplorer(), TastePosterCard() (+1 more)

### Community 6 - "getPosterUrl"
Cohesion: 0.20
Nodes (6): ExistingMovie, Feed, feeds, MovieSearch(), SearchResponse, SearchResult

### Community 7 - "compilerOptions"
Cohesion: 0.07
Nodes (26): dom, dom.iterable, esnext, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts, **/*.tsx (+18 more)

### Community 8 - "devDependencies"
Cohesion: 0.07
Nodes (27): autoprefixer, dotenv, eslint, eslint-config-next, @eslint/eslintrc, devDependencies, autoprefixer, dotenv (+19 more)

### Community 9 - "DiaryExplorer.tsx"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 10 - "roulette/page.tsx"
Cohesion: 0.18
Nodes (8): AppProviders(), AuthProvider(), Result, Toast, ToastContext, ToastContextValue, ToastProvider(), ToastTone

### Community 12 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 13 - "import/page.tsx"
Cohesion: 0.24
Nodes (9): ArtworkImage(), artworkRequests, initials(), Props, resolveArtwork(), DetailsResponse, PosterPicker(), Props (+1 more)

### Community 23 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 24 - "[id]/page.tsx"
Cohesion: 0.22
Nodes (5): inter, metadata, playfair, PageTransition(), navigation

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
Cohesion: 0.17
Nodes (11): 1. Clone & install, 2. Configure environment, 3. Push database schema, 4. Start dev server, Deploy to Vercel + Neon (free tier), 🎬 FilmJournal, Import Letterboxd Data Safely, Local Setup (+3 more)

### Community 29 - "roulette/page.tsx"
Cohesion: 0.28
Nodes (8): COUNT_OPTIONS, Genre, Person, PoolMovie, randomIndex(), RoulettePage(), tmdbImage(), WinnerDetail

### Community 30 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 31 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 32 - "LogEditor.tsx"
Cohesion: 0.60
Nodes (3): WatchlistPage(), WatchlistExplorer(), WatchlistMovie

### Community 33 - "useAuth"
Cohesion: 0.17
Nodes (11): Action, CollectionControls(), MovieResponse, Props, FavoriteToggle(), Props, KNOWN_CSVS, LetterboxdImport() (+3 more)

### Community 34 - "layout.tsx"
Cohesion: 0.11
Nodes (24): POST(), GET(), StatsPage(), enrichMovieMetadata(), enrichStatsMoviesForUser(), metadataWithoutIdentity(), missingMetadata(), archiveFingerprint() (+16 more)

### Community 35 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 36 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 37 - "StarRating.tsx"
Cohesion: 0.16
Nodes (13): LoginPage(), Tab, AuthContextType, AuthUser, useAuth(), LogEditor(), Props, today() (+5 more)

### Community 38 - "Verification and Build Instructions"
Cohesion: 0.33
Nodes (5): 1. Run Schema Updates & Client Generation, 2. Run Data Migration Script, 3. Run Validation Commands, 4. Verify Database in Prisma Studio, Verification and Build Instructions

### Community 39 - "Q: onde está a lógica de autenticação e como ela se conecta ao Prisma?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: onde está a lógica de autenticação e como ela se conecta ao Prisma?, Source Nodes

### Community 40 - "dedupe-letterboxd.ts"
Cohesion: 0.24
Nodes (12): createPlan(), dedupeLetterboxd(), Entry, eventTime(), groupAuthoritative(), MergeGroup, MoviePlan, richness() (+4 more)

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

### Community 58 - "auth.config.ts"
Cohesion: 0.25
Nodes (3): { auth }, config, PUBLIC_PATHS

## Knowledge Gaps
- **299 isolated node(s):** `metadata`, `metadata`, `STEPS`, `Props`, `artworkRequests` (+294 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `main()` connect `import-letterboxd.ts` to `scripts`?**
  _High betweenness centrality (0.109) - this node is a cross-community bridge._
- **What connects `metadata`, `metadata`, `STEPS` to the rest of the system?**
  _299 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `import-letterboxd.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07086197778952935 - nodes in this community are weakly interconnected._
- **Should `tmdb.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06490384615384616 - nodes in this community are weakly interconnected._
- **Should `lib/auth.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07315233785822021 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.044444444444444446 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.07407407407407407 - nodes in this community are weakly interconnected._