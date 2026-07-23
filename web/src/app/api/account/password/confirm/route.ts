import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isRateLimited } from "@/lib/rate-limit";
import { crossOriginResponse, isSameOrigin } from "@/lib/security";

export const dynamic = "force-dynamic";

const schema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "O código tem 6 dígitos."),
});

const MAX_ATTEMPTS = 5;

/**
 * Passo 2 da troca de senha: confere o código enviado por e-mail e, se válido,
 * aplica a nova senha guardada no passo 1. Expira, limita tentativas e apaga o
 * pendente ao concluir.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return crossOriginResponse();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Faça login para alterar a senha." }, { status: 401 });
  if (await isRateLimited(`pwd-confirm:${user.id}`, { max: 10, windowMs: 10 * 60 * 1000 })) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "O corpo deve ser um JSON válido." }, { status: 400 }); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });

  const pending = await prisma.pendingPasswordChange.findUnique({ where: { userId: user.id } });
  if (!pending) return NextResponse.json({ error: "Nenhuma troca de senha pendente. Comece de novo." }, { status: 400 });

  if (pending.expiresAt.getTime() < Date.now()) {
    await prisma.pendingPasswordChange.delete({ where: { userId: user.id } });
    return NextResponse.json({ error: "O código expirou. Solicite um novo." }, { status: 400 });
  }

  if (pending.attempts >= MAX_ATTEMPTS) {
    await prisma.pendingPasswordChange.delete({ where: { userId: user.id } });
    return NextResponse.json({ error: "Código incorreto vezes demais. Solicite um novo." }, { status: 429 });
  }

  if (!verifyPassword(parsed.data.code, pending.codeHash)) {
    await prisma.pendingPasswordChange.update({ where: { userId: user.id }, data: { attempts: { increment: 1 } } });
    return NextResponse.json({ error: "Código incorreto." }, { status: 403 });
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: pending.newPasswordHash } }),
    prisma.pendingPasswordChange.delete({ where: { userId: user.id } }),
  ]);

  return NextResponse.json({ message: "Senha atualizada." });
}
