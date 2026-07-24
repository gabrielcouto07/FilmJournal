import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, API_URL, REFRESH_COOKIE, decodeJwt } from "@/lib/api";
import { setAccessCookie } from "@/lib/auth-cookies";

const PUBLIC_PATHS = ["/login", "/api/auth"];

function isUsable(token: string | null | undefined): token is string {
  if (!token) return false;
  const exp = decodeJwt(token)?.exp;
  return typeof exp === "number" && exp * 1000 > Date.now() + 15_000;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = pathname === "/" || PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  let accessToken: string | null = request.cookies.get(ACCESS_COOKIE)?.value ?? null;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value ?? null;
  let renewed: string | null = null;

  // Renova a sessão de forma transparente quando o access token venceu.
  if (!isUsable(accessToken) && refreshToken) {
    accessToken = null;
    try {
      const upstream = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (upstream.ok) {
        const data = await upstream.json();
        renewed = typeof data?.accessToken === "string" ? data.accessToken : null;
        accessToken = renewed;
      }
    } catch {
      // API indisponível: segue sem sessão e deixa a página decidir.
    }
  }

  const claims = accessToken ? decodeJwt(accessToken) : null;
  if (!isPublic && !claims) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (pathname.startsWith("/admin") && claims?.role !== "OWNER") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!renewed) return NextResponse.next();

  // Repassa o cookie renovado aos Server Components desta requisição e persiste no navegador.
  const headers = new Headers(request.headers);
  const rest = (headers.get("cookie") ?? "")
    .split("; ")
    .filter((part) => part && !part.startsWith(`${ACCESS_COOKIE}=`));
  headers.set("cookie", [...rest, `${ACCESS_COOKIE}=${renewed}`].join("; "));

  const response = NextResponse.next({ request: { headers } });
  setAccessCookie(response, renewed);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
