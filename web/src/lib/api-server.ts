import { cookies } from "next/headers";
import { ACCESS_COOKIE, API_URL, ApiError, decodeJwt } from "./api";

export type SessionUser = {
  id: string;
  username: string;
  displayName: string | null;
  role: "OWNER" | "USER";
  email: string;
};

/** Identidade da sessão a partir do cookie de acesso (a API valida a assinatura). */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE)?.value;
  if (!token) return null;

  const claims = decodeJwt(token);
  if (!claims || claims.type !== "access" || !claims.id || !claims.username) return null;
  if (typeof claims.exp === "number" && claims.exp * 1000 <= Date.now()) return null;

  return {
    id: claims.id,
    username: claims.username,
    displayName: claims.displayName ?? null,
    role: claims.role === "OWNER" ? "OWNER" : "USER",
    email: claims.email ?? "",
  };
}

/** GET autenticado da API para Server Components; lança `ApiError` em falhas. */
export async function apiGet<T>(path: string, init: RequestInit = {}): Promise<T> {
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE)?.value;

  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, { cache: "no-store", ...init, headers });
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `Falha na API (${response.status}).`;
    throw new ApiError(message, response.status, payload);
  }
  return payload as T;
}
