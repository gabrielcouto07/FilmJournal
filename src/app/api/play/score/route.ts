import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { crossOriginResponse, isSameOrigin } from "@/lib/security";

export const dynamic = "force-dynamic";

const GAME = "cast";

const scoreSchema = z.object({
  source: z.enum(["mine", "popular"]),
  score: z.number().int().min(0).max(100_000),
  rounds: z.number().int().min(1).max(20),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Faça login." }, { status: 401 });

  const rows = await prisma.gameScore.findMany({ where: { userId: user.id, game: GAME } });
  const bySource = Object.fromEntries(rows.map((row) => [row.source, { bestScore: row.bestScore, bestRounds: row.bestRounds }]));
  return NextResponse.json({ scores: bySource });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return crossOriginResponse();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Faça login." }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "O corpo deve ser um JSON válido." }, { status: 400 }); }
  const parsed = scoreSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  const { source, score, rounds } = parsed.data;
  const current = await prisma.gameScore.findUnique({ where: { userId_game_source: { userId: user.id, game: GAME, source } } });
  const improved = !current || score > current.bestScore;

  if (improved) {
    await prisma.gameScore.upsert({
      where: { userId_game_source: { userId: user.id, game: GAME, source } },
      create: { userId: user.id, game: GAME, source, bestScore: score, bestRounds: rounds },
      update: { bestScore: score, bestRounds: rounds },
    });
  }

  return NextResponse.json({ improved, bestScore: improved ? score : current!.bestScore });
}
