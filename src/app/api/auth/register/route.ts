import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { z } from "zod";

const schema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  password: z.string().min(8).max(72),
  displayName: z.string().min(1).max(60).optional(),
});

// Simple in-memory rate limit: 5 registrations per IP per 10 minutes
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return false;
  }
  if (entry.count >= 5) return true;
  entry.count++;
  return false;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
  }

  try {
    const body = await req.json();
    const data = schema.parse(body);

    const reservedUsernames = new Set([
      "admin",
      "administrator",
      "root",
      "owner",
      "system",
      "support",
      "api",
      "null",
      "undefined",
      "me",
      "filmjournal",
    ]);
    const configuredOwnerUsername = process.env.APP_OWNER_USERNAME?.trim().toLowerCase();
    if (configuredOwnerUsername) reservedUsernames.add(configuredOwnerUsername);

    if (reservedUsernames.has(data.username.toLowerCase())) {
      return NextResponse.json({ error: "Esse nome de usuário é reservado." }, { status: 409 });
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ username: data.username }, { email: data.email }] },
    });
    if (existing) {
      return NextResponse.json(
        { error: existing.username === data.username ? "Nome de usuário já em uso." : "E-mail já cadastrado." },
        { status: 409 }
      );
    }

    const passwordHash = hashPassword(data.password);
    const user = await prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        passwordHash,
        displayName: data.displayName || data.username,
        role: "USER",
      },
    });

    return NextResponse.json({ id: user.id, username: user.username }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos.", details: err.errors }, { status: 400 });
    }
    console.error("[register]", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
