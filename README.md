# 🎬 FilmJournal

Personal film tracking app — log, rate, and explore your movie collection.

Built with **Next.js 15** · **TypeScript** · **Tailwind CSS** · **Prisma** · **PostgreSQL** · **NextAuth.js**

***

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15 App Router, Tailwind CSS |
| Auth | NextAuth.js v5 (Credentials) |
| Database | PostgreSQL via Prisma ORM |
| Hosting | Vercel (frontend) + Neon (DB) |
| External API | TMDB |

***

## Local Setup

### 1. Clone & install
```bash
git clone https://github.com/gabrielcouto07/FilmJournal
cd FilmJournal
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your own values for:

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `TMDB_API_KEY`
- `APP_OWNER_USERNAME`
- `APP_OWNER_PASSWORD`

Next.js reads `.env.local`. If Prisma on your local setup reads `.env`, duplicate
the same values into a local `.env` file. Never commit either `.env.local` or
`.env`; both are intentionally ignored by git.

**Local DB option — Docker:**
```bash
docker run -d --name filmjournal-db \
  -e POSTGRES_PASSWORD=dev \
  -e POSTGRES_DB=filmjournal \
  -p 5432:5432 postgres:16
```
Then set `DATABASE_URL="postgresql://postgres:dev@localhost:5432/filmjournal"` in `.env.local`.

### 3. Push database schema
```bash
npm run db:push
```

### 4. Start dev server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) and sign in at `/login` with
the configured owner credentials. The first owner login creates the account when
it does not exist yet.

***

## Deploy to Vercel + Neon (free tier)

1. Create a PostgreSQL database at [neon.tech](https://neon.tech) (free)
2. Import this repo at [vercel.com](https://vercel.com)
3. Use the pooled Neon connection string for `DATABASE_URL` and the direct
   (non-pooled) Neon connection string for `DIRECT_URL`.
4. Add these environment variables in the Vercel dashboard:
   - `DATABASE_URL` — pooled connection string from Neon
   - `DIRECT_URL` — direct connection string from Neon
   - `NEXTAUTH_URL` — your Vercel deployment URL
   - `NEXTAUTH_SECRET` — run `openssl rand -base64 32`
   - `TMDB_API_KEY` — from [themoviedb.org](https://www.themoviedb.org/settings/api)
   - `APP_OWNER_USERNAME` — username for the initial owner account
   - `APP_OWNER_PASSWORD` — strong password for the initial owner account
5. For a fresh Neon database, initialize the schema once from a trusted local
   terminal with the Neon environment variables loaded:

```bash
npm run db:push
```

   Commit future `prisma/migrations/` directories and apply them in production
   with `npm run db:migrate`.

`APP_OWNER_USERNAME` and `APP_OWNER_PASSWORD` are used to auto-create the initial
owner account. Once that username exists, the app resolves and promotes it without
reading the bootstrap password, so `APP_OWNER_PASSWORD` can be rotated or removed.
Keep `APP_OWNER_USERNAME` configured so public journal pages can resolve the owner.

***

## Useful commands

| Command | Description |
|---|---|
| `npm run dev` | Start local dev server |
| `npm run build` | Build for production |
| `npm run typecheck` | TypeScript check |
| `npm run db:push` | Sync schema to DB (dev) |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:migrate` | Run migrations (prod) |

***

## Security

- Passwords hashed with `scrypt` (Node built-in, no external deps)
- `NEXTAUTH_SECRET` required in all environments
- `.env` files are gitignored — never commit secrets
- Registration rate-limited (5/IP per 10 min)
- Reserved usernames blocked
