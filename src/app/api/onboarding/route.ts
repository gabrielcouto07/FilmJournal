import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { markOnboarded } from "@/lib/onboarding";
import { upsertEnrichedMovie } from "@/lib/movie-metadata";
import { CATALOG_TAG, userTag } from "@/lib/data";
import { crossOriginResponse, isSameOrigin } from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({
  seeds: z
    .array(
      z.object({
        tmdbId: z.number().int().positive(),
        rating: z
          .number()
          .min(0.5)
          .max(5)
          .refine((value) => value * 2 === Math.round(value * 2), "A nota deve ser um valor de meia estrela."),
      }),
    )
    .max(5),
});

/**
 * Finish the first-run welcome flow: seed the chosen favorites (UserMovie with
 * favorite + favoriteRank + rating, fully enriched via Chunk-1 helpers so the
 * first dashboard has real relational data) and persist onboardedAt. An empty
 * seeds array just marks the account onboarded ("pular").
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return crossOriginResponse();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "O corpo da requisição deve ser um JSON válido." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  // Dedupe by tmdbId, preserving pick order (order = favoriteRank).
  const seeds = [...new Map(parsed.data.seeds.map((seed) => [seed.tmdbId, seed])).values()];

  // Respect ranks that already exist (re-run after a partial failure, or an
  // account that somehow gained favorites mid-flow) — (userId, favoriteRank)
  // is unique.
  const occupied = await prisma.userMovie.findMany({
    where: { userId: user.id, favoriteRank: { not: null } },
    select: { favoriteRank: true },
  });
  const takenRanks = new Set(occupied.map((um) => um.favoriteRank as number));

  let seeded = 0;
  let nextRank = 1;
  for (const seed of seeds) {
    try {
      const { movie } = await upsertEnrichedMovie(seed.tmdbId);
      const existing = await prisma.userMovie.findUnique({
        where: { userId_movieId: { userId: user.id, movieId: movie.id } },
        select: { favoriteRank: true },
      });
      let rank = existing?.favoriteRank ?? null;
      if (rank == null) {
        while (takenRanks.has(nextRank)) nextRank += 1;
        rank = nextRank <= 10 ? nextRank : null;
        if (rank != null) takenRanks.add(rank);
      }
      await prisma.userMovie.upsert({
        where: { userId_movieId: { userId: user.id, movieId: movie.id } },
        create: { userId: user.id, movieId: movie.id, watched: true, favorite: true, rating: seed.rating, favoriteRank: rank },
        update: { watched: true, favorite: true, rating: seed.rating, favoriteRank: rank },
      });
      seeded += 1;
    } catch (error) {
      console.error(`[onboarding] seed tmdbId=${seed.tmdbId}`, error);
    }
  }

  // If favorites were requested but none could be saved (e.g. TMDB down),
  // keep the account un-onboarded so the flow can be retried.
  if (seeds.length > 0 && seeded === 0) {
    return NextResponse.json({ error: "Não foi possível salvar seus favoritos agora. Tente novamente." }, { status: 502 });
  }

  await markOnboarded(user.id);
  revalidateTag(userTag(user.id));
  revalidateTag(CATALOG_TAG);
  return NextResponse.json({ seeded });
}
