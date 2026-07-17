# Verification and Build Instructions

Due to Windows sandbox path mounting constraints on the environment's terminal executor (`sandbox configuration error: readwrite /: non-absolute file path`), database schema updates, dependency installs, and production builds must be verified locally.

Follow these step-by-step instructions to run the validations on your machine:

## 1. Run Schema Updates & Client Generation
Execute the following to update your SQLite database and generate the Prisma Client:
```bash
# Push schema updates to dev.db without data loss
npx prisma db push

# Generate updated types
npx prisma generate
```

## 2. Run Data Migration Script
> **Required first:** set `APP_OWNER_PASSWORD` (the password you'll log in with) and
> `AUTH_SECRET` in `.env.local` before running this. The script creates the owner
> account only once — if an owner already exists it will not overwrite the password.

Execute the migration script to transfer single-user attributes (watchlist, favorites, ratings, and diary logs) from the legacy `Movie` columns to the new `User` and `UserMovie` relation tables and to link existing `LogEntry` rows to the owner:
```bash
# Runs the user mapping and linking process (idempotent)
npx tsx scripts/migrate-user-data.ts
```
Until this runs, the app renders empty because every page is scoped to the owner's `UserMovie`/`LogEntry` records.

## 3. Run Validation Commands
Run the validation suite to confirm code styling, type safety, and test compliance:
```bash
# Type check TypeScript files
npm run typecheck

# Validate Letterboxd fixtures and importer constraints
npm run validate:letterboxd

# Build the production application bundle (also type-checks and lints)
npm run build
```

## 4. Verify Database in Prisma Studio
To inspect the tables (`User`, `Movie`, `UserMovie`, `LogEntry`) and check that data migrated correctly, run:
```bash
npx prisma studio
```
Then open [http://localhost:5555](http://localhost:5555) in your browser.
