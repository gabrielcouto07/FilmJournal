import { prisma } from "../../lib/prisma.js";
import { ensureOwnerUser } from "../../lib/auth.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { env } from "../../config/env.js";
import type { AuthUser } from "../../plugins/jwt.js";

export class InvalidCredentialsError extends Error {}
export class UsernameReservedError extends Error {}
export class UsernameOrEmailTakenError extends Error {
  constructor(public field: "username" | "email") {
    super();
  }
}

function toAuthUser(user: { id: string; username: string; displayName: string | null; role: string; email: string }): AuthUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role as AuthUser["role"],
    email: user.email,
  };
}

/** Mirrors the web app's NextAuth Credentials `authorize` callback. */
export async function login(username: string, password: string): Promise<AuthUser> {
  if (username === env.APP_OWNER_USERNAME?.trim()) {
    await ensureOwnerUser();
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new InvalidCredentialsError();
  }

  return toAuthUser(user);
}

const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "root", "owner", "system", "support", "api", "null", "undefined", "me", "filmjournal",
]);

export async function register(input: { username: string; email: string; password: string; displayName?: string }) {
  const reserved = new Set(RESERVED_USERNAMES);
  const configuredOwnerUsername = env.APP_OWNER_USERNAME?.trim().toLowerCase();
  if (configuredOwnerUsername) reserved.add(configuredOwnerUsername);

  if (reserved.has(input.username.toLowerCase())) {
    throw new UsernameReservedError();
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ username: input.username }, { email: input.email }] },
  });
  if (existing) {
    throw new UsernameOrEmailTakenError(existing.username === input.username ? "username" : "email");
  }

  const user = await prisma.user.create({
    data: {
      username: input.username,
      email: input.email,
      passwordHash: hashPassword(input.password),
      displayName: input.displayName || input.username,
      role: "USER",
    },
  });

  return { id: user.id, username: user.username };
}

export async function getUserById(id: string): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({ where: { id } });
  return user ? toAuthUser(user) : null;
}
