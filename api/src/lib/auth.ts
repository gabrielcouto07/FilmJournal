import { createHash } from "node:crypto";
import { env } from "../config/env.js";
import { prisma } from "./prisma.js";
import { hashPassword } from "./password.js";

export { hashPassword, verifyPassword } from "./password.js";

const OWNER_PASSWORD_REQUIRED =
  "APP_OWNER_PASSWORD environment variable is required to create the owner user.";

function getConfiguredOwnerUsername() {
  return env.APP_OWNER_USERNAME?.trim() || null;
}

async function findAndPromoteOwner(username: string) {
  const owner = await prisma.user.findUnique({ where: { username } });
  if (!owner || owner.role === "OWNER") return owner;

  return prisma.user.update({
    where: { id: owner.id },
    data: { role: "OWNER" },
  });
}

/** Looks up the primary account; with no config, public pages show an empty diary. */
export async function getOwnerUser() {
  const ownerUsername = getConfiguredOwnerUsername();
  if (!ownerUsername) return null;

  return findAndPromoteOwner(ownerUsername);
}

/** Looks up or creates the primary account during initial setup. */
export async function ensureOwnerUser() {
  const ownerUsername = getConfiguredOwnerUsername();
  if (!ownerUsername) return null;

  const existingOwner = await findAndPromoteOwner(ownerUsername);
  if (existingOwner) return existingOwner;

  const ownerPassword = env.APP_OWNER_PASSWORD;
  if (!ownerPassword) {
    throw new Error(OWNER_PASSWORD_REQUIRED);
  }

  const emailKey = createHash("sha256").update(ownerUsername).digest("hex").slice(0, 16);

  // Upsert avoids a conflict between concurrent boots without overwriting an existing password.
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
