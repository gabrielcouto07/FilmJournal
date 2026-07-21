# Graph Report - Letterboxc  (2026-07-21)

## Corpus Check
- 128 files · ~67,179 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 725 nodes · 1320 edges · 55 communities (39 shown, 16 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0eb1d046`
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
- graphify reference: extra exports and benchmark
- graphify reference: extra exports and benchmark
- LogEditor.tsx
- layout.tsx
- graphify reference: query, path, explain
- graphify reference: query, path, explain
- Q: onde está a lógica de autenticação e como ela se conecta ao Prisma?
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
- auth.config.ts

## God Nodes (most connected - your core abstractions)
1. `getCurrentUser` - 53 edges
2. `useToast()` - 31 edges
3. `isSameOrigin()` - 26 edges
4. `crossOriginResponse()` - 26 edges
5. `scripts` - 24 edges
6. `getPosterUrl()` - 22 edges
7. `buildCanonicalLetterboxdImport()` - 17 edges
8. `compilerOptions` - 16 edges
9. `useAuth()` - 15 edges
10. `userTag()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `runImport()`  [EXTRACTED]
  prisma/seed.ts → scripts/import-letterboxd.ts
- `backfillCollections()` --calls--> `ensureOwnerUser()`  [EXTRACTED]
  scripts/backfill-collections.ts → src/lib/auth.ts
- `saveMovie()` --calls--> `ensureOwnerUser()`  [EXTRACTED]
  scripts/import-letterboxd.ts → src/lib/auth.ts
- `saveMovie()` --calls--> `normalizeTitle()`  [EXTRACTED]
  scripts/import-letterboxd.ts → src/lib/diary-dedupe.ts
- `saveEvents()` --calls--> `ensureOwnerUser()`  [EXTRACTED]
  scripts/import-letterboxd.ts → src/lib/auth.ts

## Import Cycles
- None detected.

## Communities (55 total, 16 thin omitted)

### Community 0 - "useToast"
Cohesion: 0.08
Nodes (27): GET(), StatsPage(), RecommendationAction, TasteExplorer(), TastePosterCard(), countValues(), getStatsData(), archiveFingerprint() (+19 more)

### Community 1 - "import-letterboxd.ts"
Cohesion: 0.06
Nodes (59): @prisma/client, @prisma/client, main(), createPlan(), dedupeLetterboxd(), Entry, eventTime(), groupAuthoritative() (+51 more)

### Community 2 - "app/page.tsx"
Cohesion: 0.10
Nodes (30): DiaryPage(), FavoritesPage(), WatchlistPage(), ArtworkImage(), artworkRequests, initials(), Props, resolveArtwork() (+22 more)

### Community 3 - "lib/auth.ts"
Cohesion: 0.15
Nodes (14): DatabaseReviewPage(), metadata, SEVERITY_TONE, STATUS_ICON, GET(), DatabaseReview, getDatabaseReview(), IntegrityIssue (+6 more)

### Community 4 - "scripts"
Cohesion: 0.05
Nodes (42): fflate, framer-motion, next, next-auth, dependencies, fflate, framer-motion, next (+34 more)

### Community 5 - "recommendations.ts"
Cohesion: 0.38
Nodes (9): main(), root, saveMovie(), enrichMovieMetadata(), metadataWithoutIdentity(), missingMetadata(), getTmdbMovie(), searchTmdbMovie() (+1 more)

### Community 6 - "[id]/page.tsx"
Cohesion: 0.40
Nodes (4): useSettings(), sizes, StarRating(), StarRatingProps

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
Cohesion: 0.24
Nodes (8): Result, apply(), resolveTheme(), SettingsContext, SettingsContextValue, SettingsProvider(), AppSettings, DEFAULT_SETTINGS

### Community 12 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 13 - "import/page.tsx"
Cohesion: 0.05
Nodes (46): LoginPage(), Tab, COUNT_OPTIONS, Genre, Person, PoolMovie, randomIndex(), RoulettePage() (+38 more)

### Community 23 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 24 - "[id]/page.tsx"
Cohesion: 0.14
Nodes (7): ACCENT_PRESETS, initialsOf(), Notify, ProfileTab(), ProfileUser, Tab, TABS

### Community 25 - "Validation Report - Film Journal"
Cohesion: 0.24
Nodes (9): metadata, ProfilePage(), coerce(), getUserSettings(), LANDING_PAGES, Language, SettingsUpdate, settingsUpdateSchema (+1 more)

### Community 26 - "Part 2: Letterboxd CSV / ZIP Importer"
Cohesion: 0.25
Nodes (7): PublicProfilePage(), CardLogInfo, MovieCard(), Props, CardMovie, EnrichedMovie, UserMovieState

### Community 27 - "Current Architecture Audit - Film Journal"
Cohesion: 0.29
Nodes (6): inter, metadata, playfair, RootLayout(), AppProviders(), PageTransition()

### Community 28 - "🎬 FilmJournal"
Cohesion: 0.14
Nodes (13): 1. Clone & install, 2. Configure environment, 3. Push database schema, 4. Start dev server, Applying database migrations, Deploy to Vercel + Neon (free tier), 🎬 FilmJournal, Import Letterboxd Data Safely (+5 more)

### Community 30 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 31 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 32 - "LogEditor.tsx"
Cohesion: 0.08
Nodes (57): backfillCollections(), rootDirectory, main(), resetOwnerPassword(), rootDirectory, SafeResetError, AdminPage(), metadata (+49 more)

### Community 34 - "layout.tsx"
Cohesion: 0.06
Nodes (46): ALLOWED_COUNTS, errorResponse(), GET(), PoolMovie, shuffle(), toPoolMovie(), yearOf(), GET() (+38 more)

### Community 35 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 36 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 39 - "Q: onde está a lógica de autenticação e como ela se conecta ao Prisma?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: onde está a lógica de autenticação e como ela se conecta ao Prisma?, Source Nodes

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
- **292 isolated node(s):** `compat`, `eslintConfig`, `nextConfig`, `name`, `version` (+287 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `scripts` to `import-letterboxd.ts`?**
  _High betweenness centrality (0.122) - this node is a cross-community bridge._
- **What connects `compat`, `eslintConfig`, `nextConfig` to the rest of the system?**
  _292 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `useToast` be split into smaller, more focused modules?**
  _Cohesion score 0.08250355618776671 - nodes in this community are weakly interconnected._
- **Should `import-letterboxd.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0579476861167002 - nodes in this community are weakly interconnected._
- **Should `app/page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.10121457489878542 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.046511627906976744 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.07407407407407407 - nodes in this community are weakly interconnected._