import { createHash } from "node:crypto";
import { prisma } from "./prisma";
import { hashPassword } from "./password";

export { hashPassword, verifyPassword } from "./password";

const OWNER_PASSWORD_REQUIRED =
  "APP_OWNER_PASSWORD environment variable is required to create the owner user.";

function getConfiguredOwnerUsername() {
  return process.env.APP_OWNER_USERNAME?.trim() || null;
}

async function findAndPromoteOwner(username: string) {
  const owner = await prisma.user.findUnique({ where: { username } });
  if (!owner || owner.role === "OWNER") return owner;

  return prisma.user.update({
    where: { id: owner.id },
    data: { role: "OWNER" },
  });
}

/**
 * Resolve the configured owner for public, read-only pages. Missing bootstrap
 * configuration is treated as an empty journal instead of a runtime failure.
 */
export async function getOwnerUser() {
  const ownerUsername = getConfiguredOwnerUsername();
  if (!ownerUsername) return null;

  return findAndPromoteOwner(ownerUsername);
}

/**
 * Resolve or create the configured owner for explicit bootstrap operations.
 * The password is only read and required when no matching user exists.
 */
export async function ensureOwnerUser() {
  const ownerUsername = getConfiguredOwnerUsername();
  if (!ownerUsername) return null;

  const existingOwner = await findAndPromoteOwner(ownerUsername);
  if (existingOwner) return existingOwner;

  const ownerPassword = process.env.APP_OWNER_PASSWORD;
  if (!ownerPassword) {
    throw new Error(OWNER_PASSWORD_REQUIRED);
  }

  const emailKey = createHash("sha256").update(ownerUsername).digest("hex").slice(0, 16);

  // Upsert keeps simultaneous cold-start requests deterministic. If another
  // request creates this username first, that account is promoted without
  // replacing its password hash.
  return prisma.user.upsert({
    where: { username: ownerUsername },
    update: { role: "OWNER" },
    create: {
      username: ownerUsername,
      email: `owner-${emailKey}@filmjournal.local`,
      passwordHash: hashPassword(ownerPassword),
      displayName: "Journal Owner",
      role: "OWNER",
    },
  });
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
