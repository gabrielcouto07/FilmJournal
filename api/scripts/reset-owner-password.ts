import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { prisma } from "../src/lib/prisma.js";
import { hashPassword } from "../src/lib/password.js";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(rootDirectory, ".env.local") });
config({ path: path.join(rootDirectory, ".env") });

class SafeResetError extends Error {}

async function resetOwnerPassword() {
  if (process.env.VERCEL === "1") {
    throw new SafeResetError("This command can only be run locally.");
  }

  const ownerUsername = process.env.APP_OWNER_USERNAME?.trim();
  const ownerPassword = process.env.APP_OWNER_PASSWORD;

  if (!ownerUsername) {
    throw new SafeResetError("APP_OWNER_USERNAME environment variable is required.");
  }
  if (!ownerPassword) {
    throw new SafeResetError("APP_OWNER_PASSWORD environment variable is required.");
  }

  const owner = await prisma.user.findUnique({
    where: { username: ownerUsername },
    select: { id: true },
  });
  if (!owner) {
    throw new SafeResetError("The configured owner user was not found.");
  }

  await prisma.user.update({
    where: { id: owner.id },
    data: { passwordHash: hashPassword(ownerPassword) },
  });
}

async function main() {
  try {
    await resetOwnerPassword();
    console.log("Owner password reset successfully.");
  } catch (error) {
    if (error instanceof SafeResetError) {
      console.error(`Owner password reset failed: ${error.message}`);
    } else {
      console.error("Owner password reset failed.");
    }
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

void main();
