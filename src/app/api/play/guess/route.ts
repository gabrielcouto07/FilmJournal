import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { crossOriginResponse, isSameOrigin } from "@/lib/security";
import { getTmdbMovie, TmdbError } from "@/lib/tmdb";
import {
  actorsVisible,
  CAST_REVEALS,
  gradeGuess,
  hintUnlocked,
  MAX_GUESSES,
  posterStage,
  profileFromDetails,
  revealOrder,
} from "@/lib/play/hybrid";
import { openRound, type HybridRoundPayload } from "@/lib/play/token";

export const dynamic = "force-dynamic";

/**
 * One endpoint for the three in-round actions. `guessNumber` is the guess the
 * player is currently making (1-based) and is client-asserted — the same
 * best-effort trust model as the sealed token: it keeps answers out of the
 * network inspector, it does not fight a determined API caller.
 */
const guessSchema = z.object({
  token: z.string().min(1),
  action: z.enum(["guess", "hint", "giveup"]),
  /** TMDB id of the guessed movie (required for action=guess). */
  tmdbId: z.number().int().positive().optional(),
  guessNumber: z.number().int().min(1).max(MAX_GUESSES),
  /** 1 = keywords, 2 = tagline (required for action=hint). */
  hint: z.union([z.literal(1), z.literal(2)]).optional(),
});

/** The full answer, sent only at win, loss, or give-up. */
function answerFrom(round: HybridRoundPayload) {
  return {
    tmdbId: round.target.tmdbId,
    title: round.target.title,
    year: round.target.year,
    posterPath: round.posterPath,
    directorName: round.target.directorName,
    genres: round.target.genres.map((genre) => genre.name),
    cast: round.target.cast.slice(0, CAST_REVEALS).map((member) => member.name),
    tagline: round.tagline,
  };
}

/** The clues the NEXT guess is entitled to (new actor, poster stage, hint gates). */
function cluesFor(round: HybridRoundPayload, nextGuessNumber: number) {
  const reveals = revealOrder(round.target.cast);
  const previouslyVisible = actorsVisible(nextGuessNumber - 1, reveals.length);
  const nowVisible = actorsVisible(nextGuessNumber, reveals.length);
  const newActor = nowVisible > previouslyVisible ? reveals[nowVisible - 1] : null;
  const stage = posterStage(nextGuessNumber);
  return {
    actor: newActor ? { name: newActor.name, profilePath: newActor.profilePath } : null,
    poster: stage === "hidden" ? null : { path: round.posterPath, stage },
    hints: { keywords: hintUnlocked(1, nextGuessNumber), tagline: hintUnlocked(2, nextGuessNumber) },
  };
}

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

  if (parsed.data.action === "giveup") {
    return NextResponse.json({ answer: answerFrom(round) });
  }

  if (parsed.data.action === "hint") {
    const hint = parsed.data.hint;
    if (!hint) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    if (!hintUnlocked(hint, parsed.data.guessNumber)) {
      return NextResponse.json({ error: "Essa dica ainda não desbloqueou." }, { status: 403 });
    }
    return NextResponse.json(hint === 1 ? { keywords: round.keywords } : { tagline: round.tagline });
  }

  if (!parsed.data.tmdbId) return NextResponse.json({ error: "Escolha um filme das sugestões." }, { status: 400 });

  try {
    const guessedDetails = await getTmdbMovie(parsed.data.tmdbId);
    const guessProfile = profileFromDetails(guessedDetails);
    const grade = gradeGuess(guessProfile, round.target);
    const guessCard = { title: guessProfile.title, year: guessProfile.year };

    if (grade.correct) {
      return NextResponse.json({ correct: true, tiles: grade.tiles, guess: guessCard, answer: answerFrom(round) });
    }

    const gameOver = parsed.data.guessNumber >= MAX_GUESSES;
    return NextResponse.json({
      correct: false,
      tiles: grade.tiles,
      guess: guessCard,
      gameOver,
      ...(gameOver
        ? { answer: answerFrom(round) }
        : { next: cluesFor(round, parsed.data.guessNumber + 1) }),
    });
  } catch (error) {
    if (error instanceof TmdbError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Falha ao validar o palpite." }, { status: 502 });
  }
}
