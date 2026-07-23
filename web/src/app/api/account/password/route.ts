import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { z } from "zod";
import { getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isRateLimited } from "@/lib/rate-limit";
import { crossOriginResponse, isSameOrigin } from "@/lib/security";
import { sendPasswordCodeEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

const schema = z.object({
  currentPassword: z.string().min(1, "Informe a senha atual."),
  newPassword: z.string().min(8, "A nova senha deve ter ao menos 8 caracteres.").max(72),
});

const CODE_TTL_MS = 10 * 60 * 1000;

/**
 * Passo 1 da troca de senha: confere a senha atual, guarda a nova (hash) + um
 * código de 6 dígitos (hash) e envia o código por e-mail. A troca só acontece
 * no passo 2 (.../password/confirm), depois que o usuário informa o código.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return crossOriginResponse();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Faça login para alterar a senha." }, { status: 401 });
  // Desacelera tentativas repetidas contra a senha atual.
  if (await isRateLimited(`pwd:${user.id}`, { max: 5, windowMs: 10 * 60 * 1000 })) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "O corpo deve ser um JSON válido." }, { status: 400 }); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });

  if (!verifyPassword(parsed.data.currentPassword, user.passwordHash)) {
    return NextResponse.json({ error: "A senha atual está incorreta." }, { status: 403 });
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
    await sendPasswordCodeEmail(user.email, code, user.displayName ?? user.username);
  } catch (error) {
    // Sem e-mail enviado não há como confirmar; limpa o pendente e avisa.
    await prisma.pendingPasswordChange.delete({ where: { userId: user.id } }).catch(() => {});
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao enviar o e-mail de confirmação." }, { status: 502 });
  }

  return NextResponse.json({ message: "Enviamos um código de confirmação para o seu e-mail.", email: maskEmail(user.email) });
}

/** Mascara o e-mail para exibição (ex.: "ga••••••@dominio.com"). */
function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const shown = name.slice(0, 2);
  return `${shown}${"•".repeat(Math.max(name.length - shown.length, 1))}@${domain}`;
}
