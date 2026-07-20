import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Avatar is either a small embedded data URL (client-resized, no external infra
// required) or an https image URL. Vercel Blob upload can replace this later.
const avatarValue = z.string().max(300_000).refine(
  (value) => /^data:image\/(png|jpe?g|webp|gif);base64,/.test(value) || /^https:\/\/\S+$/.test(value),
  "Forneça um URL de imagem https ou um arquivo de imagem válido.",
);

const profileSchema = z.object({
  displayName: z.string().trim().min(1, "Informe um nome.").max(60).optional(),
  bio: z.string().trim().max(500).nullable().optional(),
  avatarUrl: avatarValue.nullable().optional(),
});

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Faça login para editar seu perfil." }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "O corpo deve ser um JSON válido." }, { status: 400 }); }

  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "Nenhuma alteração enviada." }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(parsed.data.displayName !== undefined ? { displayName: parsed.data.displayName } : {}),
      ...(parsed.data.bio !== undefined ? { bio: parsed.data.bio } : {}),
      ...(parsed.data.avatarUrl !== undefined ? { avatarUrl: parsed.data.avatarUrl } : {}),
    },
    select: { displayName: true, bio: true, avatarUrl: true },
  });

  return NextResponse.json({ profile: updated, message: "Perfil atualizado." });
}
