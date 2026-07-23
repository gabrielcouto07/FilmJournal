import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDiscoverPicks } from "@/lib/discover";
import { DIMENSION_ORDER, type GapDimension } from "@/lib/analytics/blindspots";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Faça login para descobrir pontos cegos." }, { status: 401 });

  const raw = new URL(request.url).searchParams.get("dimension");
  const focus = DIMENSION_ORDER.includes(raw as GapDimension) ? (raw as GapDimension) : undefined;

  try {
    return NextResponse.json(await getDiscoverPicks(user.id, focus));
  } catch (error) {
    console.error("[discover] failed:", error);
    return NextResponse.json({ error: "Não foi possível calcular seus pontos cegos agora." }, { status: 502 });
  }
}
