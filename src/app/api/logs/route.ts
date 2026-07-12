import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 200);

  const logs = await prisma.logEntry.findMany({
    include: { movie: true },
    orderBy: [{ watchedAt: "desc" }, { loggedAt: "desc" }],
    take: limit,
  });

  const uniqueLogs = logs.filter((log, index, entries) => {
    const identity = log.dedupeKey ?? log.id;
    return entries.findIndex((entry) => (entry.dedupeKey ?? entry.id) === identity) === index;
  });

  return NextResponse.json({ logs: uniqueLogs });
}

export async function PATCH(request: Request) {
  let body: { id?: unknown; favorite?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (typeof body.id !== "string" || !body.id || typeof body.favorite !== "boolean") {
    return NextResponse.json({ error: "id and favorite are required." }, { status: 400 });
  }

  try {
    const log = await prisma.logEntry.update({
      where: { id: body.id },
      data: { favorite: body.favorite },
    });
    return NextResponse.json(log);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Diary entry not found." }, { status: 404 });
    }
    return NextResponse.json({ error: "Could not update this diary entry." }, { status: 500 });
  }
}
