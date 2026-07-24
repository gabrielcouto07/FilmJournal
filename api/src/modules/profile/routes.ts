import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { markOnboarded, needsOnboarding } from "../../lib/onboarding.js";
import { upsertEnrichedMovie } from "../../lib/movie-metadata.js";
import { CATALOG_TAG, userTag } from "../../lib/dashboard-data.js";
import { revalidateTag } from "../../lib/cache.js";
import { getUserSettings, settingsUpdateSchema } from "../../lib/settings.js";
import { requireAuth } from "../../plugins/jwt.js";

// O avatar pode ser uma imagem reduzida no navegador ou uma URL HTTPS.
const avatarValue = z.string().max(300_000).refine(
  (value) => /^data:image\/(png|jpe?g|webp|gif);base64,/.test(value) || /^https:\/\/\S+$/.test(value),
  "Forneça um URL de imagem https ou um arquivo de imagem válido.",
);

const profileSchema = z.object({
  displayName: z.string().trim().min(1, "Informe um nome.").max(60).optional(),
  bio: z.string().trim().max(500).nullable().optional(),
  avatarUrl: avatarValue.nullable().optional(),
});

const onboardingSchema = z.object({
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

export default async function profileRoutes(fastify: FastifyInstance) {
  /** Perfil completo do usuário logado (o token JWT só carrega o essencial). */
  fastify.get("/profile", { preHandler: requireAuth }, async (request, reply) => {
    const [user, onboarded] = await Promise.all([
      prisma.user.findUnique({
        where: { id: request.user!.id },
        select: { id: true, username: true, displayName: true, bio: true, avatarUrl: true, email: true, role: true, createdAt: true },
      }),
      needsOnboarding(request.user!.id).then((pending) => !pending),
    ]);
    if (!user) return reply.status(404).send({ error: "Usuário não encontrado." });
    return reply.send({ user, onboarded });
  });

  fastify.patch<{ Body: { displayName?: unknown; bio?: unknown; avatarUrl?: unknown } }>(
    "/profile",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.user!;
      const parsed = profileSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." });
      }
      if (Object.keys(parsed.data).length === 0) {
        return reply.status(400).send({ error: "Nenhuma alteração enviada." });
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

      return reply.send({ profile: updated, message: "Perfil atualizado." });
    },
  );

  /** Finaliza a introdução, salva os favoritos escolhidos e marca a conta como pronta. */
  fastify.post<{ Body: { seeds?: unknown } }>(
    "/onboarding",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.user!;
      const parsed = onboardingSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Dados inválidos." });
      }

      // Remove repetidos sem perder a ordem escolhida.
      const seeds = [...new Map(parsed.data.seeds.map((seed) => [seed.tmdbId, seed])).values()];

      // Pula posições já ocupadas caso o fluxo esteja sendo retomado.
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
          request.log.error({ err: error, tmdbId: seed.tmdbId }, "[onboarding] seed failed");
        }
      }

      // Se nenhum favorito for salvo, mantém a introdução pendente para tentar de novo.
      if (seeds.length > 0 && seeded === 0) {
        return reply.status(502).send({ error: "Não foi possível salvar seus favoritos agora. Tente novamente." });
      }

      await markOnboarded(user.id);
      revalidateTag(userTag(user.id));
      revalidateTag(CATALOG_TAG);
      return reply.send({ seeded });
    },
  );

  fastify.get("/settings", { preHandler: requireAuth }, async (request, reply) => {
    const user = request.user!;
    return reply.send({ settings: await getUserSettings(user.id) });
  });

  fastify.patch<{ Body: Record<string, unknown> }>(
    "/settings",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.user!;
      const parsed = settingsUpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Preferências inválidas.", details: parsed.error.flatten() });
      }
      if (Object.keys(parsed.data).length === 0) {
        return reply.status(400).send({ error: "Nenhuma alteração enviada." });
      }

      try {
        await prisma.userSettings.upsert({
          where: { userId: user.id },
          create: { userId: user.id, ...parsed.data },
          update: parsed.data,
        });
      } catch (error) {
        // Compatibilidade com instalações que ainda não criaram UserSettings.
        request.log.error(error, "[settings] save failed");
        return reply
          .status(503)
          .send({ error: "As preferências ainda não podem ser salvas: as migrações do banco de dados estão pendentes (execute `npx prisma migrate deploy`)." });
      }

      return reply.send({ settings: await getUserSettings(user.id), message: "Preferências salvas." });
    },
  );
}
