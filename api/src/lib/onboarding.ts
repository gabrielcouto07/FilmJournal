import { prisma } from "./prisma.js";

/** Define se a conta ainda precisa passar pela introdução. */
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

/** Marca que a conta já concluiu ou não precisa mais da introdução. */
export async function markOnboarded(userId: string): Promise<void> {
  await prisma.userSettings.upsert({
    where: { userId },
    create: { userId, onboardedAt: new Date() },
    update: { onboardedAt: new Date() },
  });
}
