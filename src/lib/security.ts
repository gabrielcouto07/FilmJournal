import { NextResponse } from "next/server";

/** Bloqueia alterações com cookie quando a origem da requisição é diferente. */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function crossOriginResponse() {
  return NextResponse.json({ error: "Requisição de origem não permitida." }, { status: 403 });
}
