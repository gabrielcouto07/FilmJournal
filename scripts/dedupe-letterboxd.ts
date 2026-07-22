import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import type { LogEntry, Movie } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createDiaryDedupeKey, isAuthoritativeWatch } from "@/lib/diary-dedupe";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(rootDirectory, ".env.local") });
config({ path: path.join(rootDirectory, ".env") });

type Entry = LogEntry & { movie: Pick<Movie, "id" | "title" | "year"> };
type MergeGroup = { survivor: Entry; redundant: Entry[]; values: Entry[] };
type MoviePlan = {
  movie: Entry["movie"];
  entries: Entry[];
  catalogArtifacts: Entry[];
  mergeGroups: MergeGroup[];
  survivors: Entry[];
};

function eventTime(entry: Entry): number {
  return (entry.watchedAt ?? entry.loggedAt ?? entry.createdAt).getTime();
}

function richness(entry: Entry): number {
  return (entry.review?.trim() ? 16 : 0) + (entry.rating != null ? 8 : 0) + (entry.tags ? 4 : 0) + (entry.sourceUri ? 2 : 0) + (entry.rewatch ? 1 : 0);
}

function unionValues(values: Array<string | null>): string | null {
  const merged = [...new Set(values.flatMap((value) => (value ?? "").split(",").map((item) => item.trim()).filter(Boolean)))];
  return merged.length ? merged.join(", ") : null;
}

function groupAuthoritative(entries: Entry[]): MergeGroup[] {
  const grouped = new Map<string, Entry[]>();
  entries.forEach((entry) => {
    // URIs diferentes representam sessões diferentes, mesmo no mesmo dia.
    const identity = entry.sourceUri
      ? `uri:${entry.sourceUri.toLowerCase()}`
      : `key:${entry.sourceKey}`;
    grouped.set(identity, [...(grouped.get(identity) ?? []), entry]);
  });
  return [...grouped.values()].map((values) => {
    const ranked = [...values].sort((left, right) => richness(right) - richness(left) || left.createdAt.getTime() - right.createdAt.getTime());
    return { survivor: ranked[0], redundant: ranked.slice(1), values };
  });
}

async function createPlan(): Promise<MoviePlan[]> {
  const entries = await prisma.logEntry.findMany({
    include: { movie: { select: { id: true, title: true, year: true } } },
    orderBy: [{ movieId: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });
  const byMovie = new Map<string, Entry[]>();
  entries.forEach((entry) => byMovie.set(entry.movieId, [...(byMovie.get(entry.movieId) ?? []), entry]));

  return [...byMovie.values()].map((movieEntries) => {
    const authoritative = movieEntries.filter((entry) => isAuthoritativeWatch(entry.sourceType));
    const catalogArtifacts = movieEntries.filter((entry) => !isAuthoritativeWatch(entry.sourceType));
    const mergeGroups = groupAuthoritative(authoritative);
    return {
      movie: movieEntries[0].movie,
      entries: movieEntries,
      catalogArtifacts,
      mergeGroups,
      survivors: mergeGroups.map((group) => group.survivor).sort((left, right) => eventTime(left) - eventTime(right) || left.id.localeCompare(right.id)),
    };
  });
}

export async function dedupeLetterboxd(apply = false): Promise<{ before: number; after: number; removed: number; merged: number }> {
  const plans = await createPlan();
  const before = plans.reduce((total, plan) => total + plan.entries.length, 0);
  const catalogRemoved = plans.reduce((total, plan) => total + plan.catalogArtifacts.length, 0);
  const merged = plans.reduce((total, plan) => total + plan.mergeGroups.reduce((sum, group) => sum + group.redundant.length, 0), 0);
  const removed = catalogRemoved + merged;
  const after = before - removed;

  console.log(`\nLetterboxd diary cleanup ${apply ? "APPLY" : "DRY RUN"}`);
  console.log(`Before: ${before} entries | After: ${after} entries | Remove: ${removed} (${catalogRemoved} catalog artifacts, ${merged} duplicate event rows)`);
  const changed = plans.filter((plan) => plan.catalogArtifacts.length || plan.mergeGroups.some((group) => group.redundant.length));
  changed.slice(0, 30).forEach((plan) => {
    const duplicateCount = plan.mergeGroups.reduce((sum, group) => sum + group.redundant.length, 0);
    console.log(`- ${plan.movie.title} (${plan.movie.year ?? "?"}): ${plan.catalogArtifacts.length} catalog row(s), ${duplicateCount} duplicate event row(s) -> ${plan.survivors.length} real event(s)`);
  });
  if (changed.length > 30) console.log(`- …and ${changed.length - 30} more films (summary truncated; no writes have happened yet).`);

  if (!apply || removed === 0) {
    if (!apply) console.log("Dry run complete. Run with --apply only after reviewing this summary.");
    return { before, after, removed, merged };
  }

  await prisma.$transaction(async (transaction) => {
    for (const plan of plans) {
      // Este ajuste cuida apenas dos registros de diário compartilhados.
      const deleteIds = [
        ...plan.catalogArtifacts.map((entry) => entry.id),
        ...plan.mergeGroups.flatMap((group) => group.redundant.map((entry) => entry.id)),
      ];
      if (deleteIds.length) await transaction.logEntry.deleteMany({ where: { id: { in: deleteIds } } });
      if (!plan.survivors.length) continue;

      await transaction.logEntry.updateMany({ where: { id: { in: plan.survivors.map((entry) => entry.id) } }, data: { dedupeKey: null } });
      const dayOccurrences = new Map<string, number>();
      for (const survivor of plan.survivors) {
        const group = plan.mergeGroups.find((candidate) => candidate.survivor.id === survivor.id)!;
        const catalogValues = survivor.id === plan.survivors.at(-1)?.id ? plan.catalogArtifacts : [];
        const values = [...group.values, ...catalogValues];
        const eventDate = survivor.watchedAt ?? survivor.loggedAt;
        const eventDay = eventDate?.toISOString().slice(0, 10) ?? "undated";
        const occurrence = (dayOccurrences.get(eventDay) ?? 0) + 1;
        dayOccurrences.set(eventDay, occurrence);
        await transaction.logEntry.update({
          where: { id: survivor.id },
          data: {
            dedupeKey: createDiaryDedupeKey({ movieId: survivor.movieId, watchedAt: survivor.watchedAt, loggedAt: survivor.loggedAt, occurrence }),
            sourceType: unionValues(values.map((entry) => entry.sourceType)) ?? survivor.sourceType,
            sourceUri: values.find((entry) => entry.sourceUri)?.sourceUri ?? survivor.sourceUri,
            rating: survivor.rating ?? values.find((entry) => entry.rating != null)?.rating ?? null,
            review: values.find((entry) => entry.review?.trim())?.review ?? survivor.review,
            rewatch: values.some((entry) => entry.rewatch),
            tags: unionValues(values.map((entry) => entry.tags)),
            favorite: false,
          },
        });
      }
    }
  });

  const actualAfter = await prisma.logEntry.count();
  console.log(`Cleanup committed in one transaction. Database count: ${before} -> ${actualAfter}.`);
  return { before, after: actualAfter, removed: before - actualAfter, merged };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  dedupeLetterboxd(process.argv.includes("--apply"))
    .catch((error) => { console.error(error); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
