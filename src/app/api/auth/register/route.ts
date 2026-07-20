import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { isRateLimited } from "@/lib/rate-limit";
import { crossOriginResponse, isSameOrigin } from "@/lib/security";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const schema = z.object({
  username: z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().trim().email().transform((email) => email.toLowerCase()),
  password: z.string().min(8).max(72),
  displayName: z.string().trim().min(1).max(60).optional(),
});

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return crossOriginResponse();

  // 5 registrations per IP per 10 minutes, backed by a shared store so the
  // limit survives serverless cold starts (in-memory fallback inside).
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  if (await isRateLimited(`register:${ip}`, { max: 5, windowMs: 10 * 60 * 1000 })) {
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
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "Nome de usuário ou e-mail já cadastrado." }, { status: 409 });
    }
    console.error("[register]", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
