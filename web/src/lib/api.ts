/**
 * Cliente HTTP do frontend para a API FilmJournal (Fastify).
 * O access token JWT vive num cookie legível pelo navegador; o refresh token
 * fica num cookie httpOnly gerenciado pelas rotas /api/auth/* deste app.
 */

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export const ACCESS_COOKIE = "fj_access";
export const REFRESH_COOKIE = "fj_refresh";

export class ApiError extends Error {
  constructor(message: string, public status: number, public payload: unknown = null) {
    super(message);
    this.name = "ApiError";
  }
}

export type JwtClaims = {
  exp?: number;
  type?: string;
  id?: string;
  username?: string;
  displayName?: string | null;
  role?: string;
  email?: string;
};

/** Decodifica o payload do JWT sem verificar a assinatura — a API é quem valida. */
export function decodeJwt(token: string): JwtClaims | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const binary = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as JwtClaims;
  } catch {
    return null;
  }
}

export function readAccessCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${ACCESS_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

let refreshPromise: Promise<boolean> | null = null;

/** Renova o access token uma única vez, mesmo com chamadas concorrentes. */
async function refreshSession(): Promise<boolean> {
  refreshPromise ??= fetch("/api/auth/refresh", { method: "POST" })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

/**
 * `fetch` para a API: prefixa a URL base, envia o Bearer token e, em caso de
 * 401, tenta renovar a sessão e repete a chamada uma vez.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const attempt = () => {
    const headers = new Headers(init.headers);
    const token = readAccessCookie();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(`${API_URL}${path}`, { ...init, headers });
  };

  let response = await attempt();
  if (response.status === 401 && (await refreshSession())) {
    response = await attempt();
  }
  return response;
}
