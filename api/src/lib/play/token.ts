import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "../../config/env.js";
import type { MovieProfile } from "./hybrid.js";

/** Seals the round response with AES-256-GCM without keeping server-side state. */

export type HybridRoundPayload = {
  /** Full profile of the secret movie. */
  target: MovieProfile;
  posterPath: string | null;
  /** First hint: up to three TMDB keywords. */
  keywords: string[];
  /** Second hint's content. */
  tagline: string | null;
  source: "mine" | "popular" | "daily";
  /** Moment the token expires. */
  exp: number;
};

function key(): Buffer {
  return createHash("sha256").update(env.JWT_SECRET).digest();
}

export function sealRound(payload: HybridRoundPayload): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
}

/** Returns `null` for tampered, invalid, or expired tokens. */
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
