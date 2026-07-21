import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { dismissBlindSpot } from "@/lib/discover";
import { crossOriginResponse, isSameOrigin } from "@/lib/security";

export const dynamic = "force-dynamic";

const dismissSchema = z.object({
  dimension: z.enum(["decade", "country", "language", "genre"]),
  // A bucket key ("1960", "JP", "ja", TMDB genre id) or "*" to mute the dimension.
  gapKey: z.string().trim().min(1).max(20),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return crossOriginResponse();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Faça login para ajustar suas sugestões." }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "O corpo deve ser um JSON válido." }, { status: 400 }); }

  const parsed = dismissSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  await dismissBlindSpot(user.id, parsed.data.dimension, parsed.data.gapKey);
  return NextResponse.json({ ok: true, message: "Não vamos mais sugerir essa lacuna." });
}
