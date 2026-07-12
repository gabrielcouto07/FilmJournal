import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { prisma } from "@/lib/prisma";
import { createDiaryDedupeKey } from "@/lib/diary-dedupe";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(rootDirectory, ".env.local") });
config({ path: path.join(rootDirectory, ".env") });

type Entry = Awaited<ReturnType<typeof prisma.logEntry.findMany>>[number];

function entryScore(entry: Entry): number {
  return (entry.review?.trim() ? 8 : 0) + (entry.rating != null ? 4 : 0) + (entry.favorite ? 2 : 0) + (entry.rewatch ? 1 : 0);
}

function unionValues(values: Array<string | null>): string | null {
  const merged = [...new Set(values.flatMap((value) => (value ?? "").split(",").map((item) => item.trim()).filter(Boolean)))];
  return merged.length ? merged.join(", ") : null;
}

export async function dedupeDiary(): Promise<{ removed: number; retained: number }> {
  const entries = await prisma.logEntry.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  const groups = new Map<string, Entry[]>();

  for (const entry of entries) {
    const key = createDiaryDedupeKey(entry);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }

  let removed = 0;
  let retained = 0;

  for (const [dedupeKey, group] of groups) {
    const ranked = [...group].sort((left, right) => entryScore(right) - entryScore(left) || left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id));
    const survivor = ranked[0];
    const duplicates = ranked.slice(1);
    const richestReview = ranked.find((entry) => entry.review?.trim())?.review ?? null;
    const richestRating = ranked.find((entry) => entry.rating != null)?.rating ?? null;

    await prisma.$transaction(async (transaction) => {
      if (duplicates.length) {
        await transaction.logEntry.deleteMany({ where: { id: { in: duplicates.map((entry) => entry.id) } } });
      }

      await transaction.logEntry.update({
        where: { id: survivor.id },
        data: {
          dedupeKey,
          sourceType: unionValues(group.map((entry) => entry.sourceType)) ?? survivor.sourceType,
          sourceUri: ranked.find((entry) => entry.sourceUri)?.sourceUri ?? survivor.sourceUri,
          rating: richestRating,
          review: richestReview,
          favorite: group.some((entry) => entry.favorite),
          rewatch: group.some((entry) => entry.rewatch),
          tags: unionValues(group.map((entry) => entry.tags)),
        },
      });
    });

    retained += 1;
    removed += duplicates.length;
  }

  console.log(`Diary dedupe complete: removed ${removed} duplicate entries; assigned keys to ${retained} dated entries.`);
  return { removed, retained };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  dedupeDiary()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
