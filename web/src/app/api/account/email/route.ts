import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getCurrentUser, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isRateLimited } from "@/lib/rate-limit";
import { crossOriginResponse, isSameOrigin } from "@/lib/security";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email("E-mail inválido.").max(200),
  currentPassword: z.string().min(1, "Confirme com a senha atual."),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return crossOriginResponse();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Faça login para alterar o e-mail." }, { status: 401 });
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

  try {
    await prisma.user.update({ where: { id: user.id }, data: { email: parsed.data.email } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Este e-mail já está em uso." }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json({ message: "E-mail atualizado." });
}
