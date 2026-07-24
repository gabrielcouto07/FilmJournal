# filmjournal-api

Standalone backend for FilmJournal, extracted from the `web` Next.js app so both
`web` and `ios` consume it as regular API clients.

## Stack

- Node.js + TypeScript
- Fastify (HTTP layer) + `fastify-type-provider-zod` for request/response validation
- Prisma + PostgreSQL
- JWT (access + refresh) auth, replacing the web app's NextAuth cookie sessions
- `@fastify/swagger` — generates an OpenAPI contract both `web` and `ios` can consume/generate clients from

## Local development

```bash
cp .env.example .env      # fill in TMDB_API_KEY, JWT_SECRET, etc.
docker compose up -d      # local Postgres
npm install
npm run db:migrate
npm run dev
```

Server boots on `PORT` (default `4000`), health check at `GET /health`.

## Structure

- `src/modules/*` — one folder per domain (auth, movies, discover, recommendations,
  roulette, play, import, settings, account, admin), each with `routes.ts` +
  `service.ts` + `schema.ts`.
- `src/lib/*` — framework-agnostic business logic ported from `web/src/lib`.
- `src/plugins/*` — Fastify plugins (Prisma client, JWT auth, CORS, rate limiting, OpenAPI).
- `prisma/` — schema, migrations, seed script (ported as-is from `web/prisma`).
- `scripts/` — ops scripts (Letterboxd import/dedupe, TMDB backfill, owner reset).

## Migrating from `web`

This repo was split out of `FilmJournal/web`. The database, Prisma schema, and
`src/lib` business logic moved over close to unchanged; the Next.js Route
Handlers were rewritten as Fastify routes, and auth moved from NextAuth cookie
sessions to stateless JWTs so both `web` and `ios` can authenticate the same way.
