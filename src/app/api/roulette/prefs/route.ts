import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { crossOriginResponse, isSameOrigin } from "@/lib/security";

export const dynamic = "force-dynamic";

// The last-used roulette setup, persisted per user (UserSettings.rouletteFilters)
// so the same intent is preloaded on the next visit, on any device.
const prefsSchema = z.object({
  source: z.enum(["popular", "watchlist", "blindspots"]),
  genres: z.array(z.number().int().positive()).max(10),
  people: z.array(z.object({ id: z.number().int().positive(), name: z.string().trim().min(1).max(80) })).max(5),
  yearFrom: z.string().regex(/^\d{0,4}$/),
  yearTo: z.string().regex(/^\d{0,4}$/),
  runtimeMax: z.number().int().min(60).max(240),
  count: z.union([z.literal(4), z.literal(8), z.literal(16)]),
});

export type RoulettePrefs = z.infer<typeof prefsSchema>;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Faça login." }, { status: 401 });

  const settings = await prisma.userSettings.findUnique({ where: { userId: user.id }, select: { rouletteFilters: true } });
  const parsed = prefsSchema.safeParse(settings?.rouletteFilters);
  return NextResponse.json({ prefs: parsed.success ? parsed.data : null });
}

export async function PUT(request: Request) {
  if (!isSameOrigin(request)) return crossOriginResponse();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Faça login." }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "O corpo deve ser um JSON válido." }, { status: 400 }); }

  const parsed = prefsSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Filtros inválidos." }, { status: 400 });

  await prisma.userSettings.upsert({
    where: { userId: user.id },
    create: { userId: user.id, rouletteFilters: parsed.data },
    update: { rouletteFilters: parsed.data },
  });
  return NextResponse.json({ ok: true });
}
