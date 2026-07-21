import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { crossOriginResponse, isSameOrigin } from "@/lib/security";
import { isCorrectGuess, MAX_REVEALS } from "@/lib/play/scoring";
import { openRound } from "@/lib/play/token";

export const dynamic = "force-dynamic";

const guessSchema = z.object({
  token: z.string().min(1),
  action: z.enum(["guess", "hint", "giveup"]),
  guess: z.string().trim().max(200).optional(),
  /** How many cast members the client currently shows. */
  revealed: z.number().int().min(1).max(MAX_REVEALS),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return crossOriginResponse();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Faça login para jogar." }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "O corpo deve ser um JSON válido." }, { status: 400 }); }
  const parsed = guessSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  const round = openRound(parsed.data.token);
  if (!round) return NextResponse.json({ error: "Rodada expirada — comece outra." }, { status: 410 });

  const answer = {
    tmdbId: round.tmdbId,
    title: round.title,
    year: round.year,
    posterPath: round.posterPath,
    cast: round.cast,
  };
  const nextCast = round.cast[parsed.data.revealed] ?? null;

  if (parsed.data.action === "giveup") {
    return NextResponse.json({ correct: false, answer });
  }
  if (parsed.data.action === "hint") {
    return NextResponse.json({ nextCast });
  }

  const correct = isCorrectGuess(parsed.data.guess ?? "", [round.title, round.originalTitle]);
  // A wrong guess auto-reveals the next name (when one remains) — same cost as a hint.
  return NextResponse.json(correct ? { correct: true, answer } : { correct: false, nextCast });
}
