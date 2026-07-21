import { prisma } from "./prisma";

/**
 * First-run onboarding state. A brand-new account (zero LogEntry and zero
 * UserMovie rows, never onboarded) is routed to /welcome by the landing pages.
 *
 * Accounts that already have journal data are marked onboarded on first check —
 * this covers users the migration backfill couldn't see (data but no
 * UserSettings row yet) and anyone who fills their journal through the
 * Letterboxd import instead of the guided flow.
 */
export async function needsOnboarding(userId: string): Promise<boolean> {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { onboardedAt: true },
  });
  if (settings?.onboardedAt) return false;

  const [userMovies, logs] = await Promise.all([
    prisma.userMovie.count({ where: { userId } }),
    prisma.logEntry.count({ where: { userId } }),
  ]);
  if (userMovies === 0 && logs === 0) return true;

  await markOnboarded(userId);
  return false;
}

/** Persist that this account has seen (or no longer needs) the welcome flow. */
export async function markOnboarded(userId: string): Promise<void> {
  await prisma.userSettings.upsert({
    where: { userId },
    create: { userId, onboardedAt: new Date() },
    update: { onboardedAt: new Date() },
  });
}
