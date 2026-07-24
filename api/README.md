# filmjournal-api

Backend do FilmJournal. O frontend `web` (e futuramente o `ios`) consome esta API
como cliente HTTP comum — nenhum deles acessa o banco diretamente.

## Stack

- Node.js + TypeScript
- Fastify (HTTP layer) + Zod for request/response validation
- Prisma + PostgreSQL
- JWT auth (access + refresh), igual para todos os clientes
- `@fastify/swagger` — OpenAPI em `/docs`

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

- `src/modules/*` — um domínio por pasta (auth, movies, logs/import, account,
  profile/settings/onboarding, discover/recommendations, roulette, play,
  dashboard, admin), cada um com suas rotas.
- `src/lib/*` — regras de negócio independentes de framework (analytics, TMDB,
  importação do Letterboxd, e-mail, cache).
- `src/plugins/*` — plugins do Fastify (Prisma, JWT, CORS, rate limiting, OpenAPI).
- `prisma/` — schema, migrações e seed.
- `scripts/` — scripts de operação (import/dedupe do Letterboxd, backfill do TMDB, reset do owner).
- `tests/` — 71 testes das 8 suítes de lógica pura (`npm test`).

## Auth

`POST /auth/login` (ou `/auth/register`) devolve `{ accessToken, refreshToken, user }`.
Envie `Authorization: Bearer <accessToken>` nas demais rotas e renove com
`POST /auth/refresh` quando expirar (15 min por padrão).
