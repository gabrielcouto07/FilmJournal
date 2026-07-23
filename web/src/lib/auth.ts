import { createHash } from "node:crypto";
import { cache } from "react";
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

/** Busca a conta principal; sem configuração, páginas públicas mostram um diário vazio. */
export async function getOwnerUser() {
  const ownerUsername = getConfiguredOwnerUsername();
  if (!ownerUsername) return null;

  return findAndPromoteOwner(ownerUsername);
}

/** Busca ou cria a conta principal durante a configuração inicial. */
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

  // O upsert evita conflito entre inicializações simultâneas sem trocar a senha existente.
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

/** Retorna o usuário da sessão atual ou `null`. */
export const getCurrentUser = cache(async () => {
  // O import tardio evita carregar o Auth.js nos scripts de linha de comando.
  // O cache reaproveita a consulta dentro da mesma renderização.
  const { auth } = await import("@/auth");
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  return prisma.user.findUnique({ where: { id: userId } });
});
