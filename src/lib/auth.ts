import { prisma } from "./prisma";
import { hashPassword } from "./password";

export { hashPassword, verifyPassword } from "./password";

/**
 * Resolve the single "owner" account used to scope this personal journal's
 * public (read-only) data. Falls back to the configured username and, in a
 * fresh environment, auto-creates the owner from APP_OWNER_* env vars.
 */
export async function getOwnerUser() {
  const ownerUsername = process.env.APP_OWNER_USERNAME || "admin";

  let owner = await prisma.user.findFirst({ where: { role: "OWNER" } });
  if (!owner) {
    owner = await prisma.user.findUnique({ where: { username: ownerUsername } });
  }
  if (!owner) {
    const ownerPassword = process.env.APP_OWNER_PASSWORD;
    if (!ownerPassword && process.env.NODE_ENV !== "test") {
      throw new Error("APP_OWNER_PASSWORD environment variable is required to auto-create the owner user.");
    }
    const finalPassword = ownerPassword || "test-env-password-only";
    try {
      owner = await prisma.user.create({
        data: {
          username: ownerUsername,
          email: process.env.APP_OWNER_EMAIL || "admin@filmjournal.local",
          passwordHash: hashPassword(finalPassword),
          displayName: "Journal Owner",
          role: "OWNER",
        },
      });
    } catch (e) {
      console.warn("Auto-creation of owner user failed:", e);
    }
  }
  return owner;
}

/**
 * The currently authenticated user (via the NextAuth session), or null.
 * API route handlers use this to gate owner-only writes.
 */
export async function getCurrentUser() {
  // Imported lazily so CLI scripts that only need `getOwnerUser` don't pull
  // the NextAuth runtime (and the `@/auth` alias) into a bare tsx process.
  const { auth } = await import("@/auth");
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  return prisma.user.findUnique({ where: { id: userId } });
}
