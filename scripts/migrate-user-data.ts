import { pbkdf2Sync, randomBytes } from "node:crypto";
import { prisma } from "../src/lib/prisma";

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  const ownerPassword = process.env.APP_OWNER_PASSWORD;
  if (!ownerPassword) {
    throw new Error("APP_OWNER_PASSWORD environment variable is required to run the data migration.");
  }
  const ownerUsername = process.env.APP_OWNER_USERNAME || "admin";
  const ownerEmail = process.env.APP_OWNER_EMAIL || "admin@filmjournal.local";

  console.log(`Starting user data migration...`);

  // 1. Create or get owner user
  let owner = await prisma.user.findFirst({
    where: { role: "OWNER" },
  });

  if (!owner) {
    console.log(`Creating default OWNER user: ${ownerUsername} (${ownerEmail})`);
    owner = await prisma.user.create({
      data: {
        username: ownerUsername,
        email: ownerEmail,
        passwordHash: hashPassword(ownerPassword),
        displayName: "Journal Owner",
        role: "OWNER",
      },
    });
  } else {
    console.log(`OWNER user already exists: ${owner.username}`);
  }

  // 2. Find all movies with personal state
  const movies = await prisma.movie.findMany();
  console.log(`Found ${movies.length} movies. Migrating personal state to UserMovie...`);

  let userMovieCount = 0;
  for (const movie of movies) {
    // Check if the movie has any personal state to migrate
    const hasPersonalState =
      movie.watched ||
      movie.favorite ||
      movie.favoriteRank !== null ||
      movie.watchlist ||
      movie.rating !== null;

    if (hasPersonalState) {
      // Upsert UserMovie
      await prisma.userMovie.upsert({
        where: {
          userId_movieId: {
            userId: owner.id,
            movieId: movie.id,
          },
        },
        create: {
          userId: owner.id,
          movieId: movie.id,
          watched: movie.watched,
          favorite: movie.favorite,
          favoriteRank: movie.favoriteRank,
          watchlist: movie.watchlist,
          watchlistAddedAt: movie.watchlistAddedAt,
          rating: movie.rating,
        },
        update: {
          watched: movie.watched,
          favorite: movie.favorite,
          favoriteRank: movie.favoriteRank,
          watchlist: movie.watchlist,
          watchlistAddedAt: movie.watchlistAddedAt,
          rating: movie.rating,
        },
      });
      userMovieCount++;
    }
  }
  console.log(`Created/updated ${userMovieCount} UserMovie entries for owner ${owner.username}.`);

  // 3. Update all LogEntry entries to link to owner user
  const logEntries = await prisma.logEntry.findMany({
    where: { userId: null },
  });

  console.log(`Found ${logEntries.length} log entries without a user. Linking to owner...`);
  if (logEntries.length > 0) {
    const updated = await prisma.logEntry.updateMany({
      where: { userId: null },
      data: {
        userId: owner.id,
      },
    });
    console.log(`Linked ${updated.count} log entries to owner.`);
  }

  console.log(`User data migration completed successfully!`);
}

main()
  .catch((e) => {
    console.error(`Migration script failed:`, e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
