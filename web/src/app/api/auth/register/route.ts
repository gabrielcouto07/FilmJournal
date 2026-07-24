import { NextResponse } from "next/server";
import { API_URL } from "@/lib/api";
import { setSessionCookies } from "@/lib/auth-cookies";

export async function POST(request: Request) {
  const upstream = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: await request.text(),
  });
  const data = await upstream.json().catch(() => ({ error: "Não foi possível criar a conta agora." }));
  if (!upstream.ok) return NextResponse.json(data, { status: upstream.status });

  // A API já devolve tokens no cadastro: a conta nova entra logada.
  const response = NextResponse.json({ user: data.user }, { status: 201 });
  setSessionCookies(response, data.accessToken, data.refreshToken);
  return response;
}
