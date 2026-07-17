import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

// Salted PBKDF2 (sha512) password hashing. Kept in its own module with no
// framework imports so it can be shared by the NextAuth Credentials provider
// and server utilities without creating an import cycle through `@/auth`.

const ITERATIONS = 1000;
const KEYLEN = 64;
const DIGEST = "sha512";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, passwordHash: string): boolean {
  try {
    const [salt, hash] = passwordHash.split(":");
    if (!salt || !hash) return false;
    const computedHash = pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString("hex");
    return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(computedHash, "hex"));
  } catch {
    return false;
  }
}
