import type { FastifyInstance } from "fastify";
import { randomInt } from "crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { hashPassword, verifyPassword } from "../../lib/auth.js";
import { prisma } from "../../lib/prisma.js";
import { isRateLimited } from "../../lib/rate-limit.js";
import { sendPasswordCodeEmail } from "../../lib/email.js";
import { requireAuth } from "../../plugins/jwt.js";

const deleteSchema = z.object({
  confirm: z.string(),
  currentPassword: z.string().min(1, "Confirme com a senha atual."),
});

const emailSchema = z.object({
  email: z.string().email("E-mail inválido.").max(200),
  currentPassword: z.string().min(1, "Confirme com a senha atual."),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Informe a senha atual."),
  newPassword: z.string().min(8, "A nova senha deve ter ao menos 8 caracteres.").max(72),
});

const passwordConfirmSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "O código tem 6 dígitos."),
});

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

/** Mascara o e-mail para exibição (ex.: "ga••••••@dominio.com"). */
function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const shown = name.slice(0, 2);
  return `${shown}${"•".repeat(Math.max(name.length - shown.length, 1))}@${domain}`;
}

export default async function accountRoutes(fastify: FastifyInstance) {
  fastify.delete<{ Body: { confirm?: unknown; currentPassword?: unknown } }>(
    "/account",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.user!;
      if (await isRateLimited(`pwd:${user.id}`, { max: 5, windowMs: 10 * 60 * 1000 })) {
        return reply.status(429).send({ error: "Muitas tentativas. Aguarde alguns minutos." });
      }

      // A conta principal sustenta o diário público e não pode ser excluída.
      if (user.role === "OWNER") {
        return reply.status(403).send({ error: "A conta do proprietário não pode ser excluída." });
      }

      const parsed = deleteSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." });
      if (parsed.data.confirm.trim().toUpperCase() !== "EXCLUIR") {
        return reply.status(400).send({ error: 'Digite "EXCLUIR" para confirmar.' });
      }

      const fullUser = await prisma.user.findUnique({ where: { id: user.id } });
      if (!fullUser || !verifyPassword(parsed.data.currentPassword, fullUser.passwordHash)) {
        return reply.status(403).send({ error: "A senha atual está incorreta." });
      }

      // A exclusão apaga apenas os dados ligados ao usuário; o catálogo é compartilhado.
      await prisma.user.delete({ where: { id: user.id } });
      return reply.send({ message: "Conta excluída." });
    },
  );

  fastify.post<{ Body: { email?: unknown; currentPassword?: unknown } }>(
    "/account/email",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.user!;
      if (await isRateLimited(`pwd:${user.id}`, { max: 5, windowMs: 10 * 60 * 1000 })) {
        return reply.status(429).send({ error: "Muitas tentativas. Aguarde alguns minutos." });
      }

      const parsed = emailSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." });

      const fullUser = await prisma.user.findUnique({ where: { id: user.id } });
      if (!fullUser || !verifyPassword(parsed.data.currentPassword, fullUser.passwordHash)) {
        return reply.status(403).send({ error: "A senha atual está incorreta." });
      }

      try {
        await prisma.user.update({ where: { id: user.id }, data: { email: parsed.data.email } });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          return reply.status(409).send({ error: "Este e-mail já está em uso." });
        }
        throw error;
      }

      return reply.send({ message: "E-mail atualizado." });
    },
  );

  /**
   * Passo 1 da troca de senha: confere a senha atual, guarda a nova (hash) + um
   * código de 6 dígitos (hash) e envia o código por e-mail. A troca só acontece
   * no passo 2 (.../password/confirm), depois que o usuário informa o código.
   */
  fastify.post<{ Body: { currentPassword?: unknown; newPassword?: unknown } }>(
    "/account/password",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.user!;
      // Desacelera tentativas repetidas contra a senha atual.
      if (await isRateLimited(`pwd:${user.id}`, { max: 5, windowMs: 10 * 60 * 1000 })) {
        return reply.status(429).send({ error: "Muitas tentativas. Aguarde alguns minutos." });
      }

      const parsed = passwordSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." });

      const fullUser = await prisma.user.findUnique({ where: { id: user.id } });
      if (!fullUser || !verifyPassword(parsed.data.currentPassword, fullUser.passwordHash)) {
        return reply.status(403).send({ error: "A senha atual está incorreta." });
      }

      const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
      const expiresAt = new Date(Date.now() + CODE_TTL_MS);
      const pending = {
        codeHash: hashPassword(code),
        newPasswordHash: hashPassword(parsed.data.newPassword),
        expiresAt,
        attempts: 0,
      };

      await prisma.pendingPasswordChange.upsert({
        where: { userId: user.id },
        create: { userId: user.id, ...pending },
        update: pending,
      });

      try {
        await sendPasswordCodeEmail(fullUser.email, code, fullUser.displayName ?? fullUser.username);
      } catch (error) {
        // Sem e-mail enviado não há como confirmar; limpa o pendente e avisa.
        await prisma.pendingPasswordChange.delete({ where: { userId: user.id } }).catch(() => {});
        return reply.status(502).send({ error: error instanceof Error ? error.message : "Falha ao enviar o e-mail de confirmação." });
      }

      return reply.send({ message: "Enviamos um código de confirmação para o seu e-mail.", email: maskEmail(fullUser.email) });
    },
  );

  /**
   * Passo 2 da troca de senha: confere o código enviado por e-mail e, se válido,
   * aplica a nova senha guardada no passo 1. Expira, limita tentativas e apaga o
   * pendente ao concluir.
   */
  fastify.post<{ Body: { code?: unknown } }>(
    "/account/password/confirm",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.user!;
      if (await isRateLimited(`pwd-confirm:${user.id}`, { max: 10, windowMs: 10 * 60 * 1000 })) {
        return reply.status(429).send({ error: "Muitas tentativas. Aguarde alguns minutos." });
      }

      const parsed = passwordConfirmSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." });

      const pending = await prisma.pendingPasswordChange.findUnique({ where: { userId: user.id } });
      if (!pending) return reply.status(400).send({ error: "Nenhuma troca de senha pendente. Comece de novo." });

      if (pending.expiresAt.getTime() < Date.now()) {
        await prisma.pendingPasswordChange.delete({ where: { userId: user.id } });
        return reply.status(400).send({ error: "O código expirou. Solicite um novo." });
      }

      if (pending.attempts >= MAX_ATTEMPTS) {
        await prisma.pendingPasswordChange.delete({ where: { userId: user.id } });
        return reply.status(429).send({ error: "Código incorreto vezes demais. Solicite um novo." });
      }

      if (!verifyPassword(parsed.data.code, pending.codeHash)) {
        await prisma.pendingPasswordChange.update({ where: { userId: user.id }, data: { attempts: { increment: 1 } } });
        return reply.status(403).send({ error: "Código incorreto." });
      }

      await prisma.$transaction([
        prisma.user.update({ where: { id: user.id }, data: { passwordHash: pending.newPasswordHash } }),
        prisma.pendingPasswordChange.delete({ where: { userId: user.id } }),
      ]);

      return reply.send({ message: "Senha atualizada." });
    },
  );
}
