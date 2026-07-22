import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { MovieProfile } from "./hybrid";

/**
 * Round tokens for Cine-Detetive. The answer (full grading profile + hint
 * material) is AES-256-GCM sealed so the server stays stateless while the
 * client cannot read the answer out of a network inspector — clue data is only
 * ever sent when its guess number arrives. Key derives from NEXTAUTH_SECRET.
 */

export type HybridRoundPayload = {
  /** The target's full grading profile (also the answer reveal). */
  target: MovieProfile;
  posterPath: string | null;
  /** Hint 1 material: up to three TMDB keywords. */
  keywords: string[];
  /** Hint 2 material. */
  tagline: string | null;
  source: "mine" | "popular" | "daily";
  /** Epoch ms after which the token is rejected. */
  exp: number;
};

function key(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required to seal game rounds.");
  return createHash("sha256").update(secret).digest();
}

export function sealRound(payload: HybridRoundPayload): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
}

/** Returns null for tampered, malformed, or expired tokens. */
export function openRound(token: string): HybridRoundPayload | null {
  try {
    const raw = Buffer.from(token, "base64url");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ciphertext = raw.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    const payload = JSON.parse(plain) as HybridRoundPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
