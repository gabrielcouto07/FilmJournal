import { prisma } from "./prisma";

type Options = { max: number; windowMs: number };

// Usa memória como reserva quando a tabela de limites não está disponível.
const memory = new Map<string, { count: number; resetAt: number }>();

function memoryLimited(key: string, { max, windowMs }: Options): boolean {
  const now = Date.now();
  const entry = memory.get(key);
  if (!entry || now > entry.resetAt) {
    memory.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  if (entry.count >= max) return true;
  entry.count += 1;
  return false;
}

/** Retorna `true` quando a chave passa do limite dentro da janela. */
export async function isRateLimited(key: string, options: Options): Promise<boolean> {
  const now = new Date();
  try {
    const existing = await prisma.rateLimit.findUnique({ where: { key } });
    if (!existing || existing.resetAt < now) {
      const resetAt = new Date(now.getTime() + options.windowMs);
      await prisma.rateLimit.upsert({
        where: { key },
        create: { key, count: 1, resetAt },
        update: { count: 1, resetAt },
      });
      // Limpa janelas antigas sem atrapalhar a requisição se falhar.
      prisma.rateLimit.deleteMany({ where: { resetAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } } }).catch(() => {});
      return false;
    }
    if (existing.count >= options.max) return true;
    await prisma.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
    return false;
  } catch {
    return memoryLimited(key, options);
  }
}
