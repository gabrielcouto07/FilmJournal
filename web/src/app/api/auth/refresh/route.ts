import { NextResponse, type NextRequest } from "next/server";
import { API_URL, REFRESH_COOKIE } from "@/lib/api";
import { clearSessionCookies, setAccessCookie } from "@/lib/auth-cookies";

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
  }

  const upstream = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  const data = await upstream.json().catch(() => null);

  if (!upstream.ok || !data?.accessToken) {
    const response = NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
    clearSessionCookies(response);
    return response;
  }

  const response = NextResponse.json({ user: data.user });
  setAccessCookie(response, data.accessToken);
  return response;
}
