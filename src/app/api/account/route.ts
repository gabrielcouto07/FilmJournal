import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const schema = z.object({
  confirm: z.string(),
  currentPassword: z.string().min(1, "Confirme com a senha atual."),
});

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Faça login para excluir a conta." }, { status: 401 });

  // The owner account anchors public journal resolution; block its deletion.
  if (user.role === "OWNER") {
    return NextResponse.json({ error: "A conta do proprietário não pode ser excluída." }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "O corpo deve ser um JSON válido." }, { status: 400 }); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  if (parsed.data.confirm.trim().toUpperCase() !== "EXCLUIR") {
    return NextResponse.json({ error: 'Digite "EXCLUIR" para confirmar.' }, { status: 400 });
  }
  if (!verifyPassword(parsed.data.currentPassword, user.passwordHash)) {
    return NextResponse.json({ error: "A senha atual está incorreta." }, { status: 403 });
  }

  // Cascades to the user's UserMovie, LogEntry and UserSettings; the shared
  // catalog and other users' data are untouched.
  await prisma.user.delete({ where: { id: user.id } });
  return NextResponse.json({ message: "Conta excluída." });
}
