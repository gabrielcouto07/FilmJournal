import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(":");
    if (!salt || !hash) return false;

    const derived = scryptSync(password, salt, 64);
    const storedHash = Buffer.from(hash, "hex");
    if (storedHash.length !== derived.length) return false;

    return timingSafeEqual(storedHash, derived);
  } catch {
    return false;
  }
}
