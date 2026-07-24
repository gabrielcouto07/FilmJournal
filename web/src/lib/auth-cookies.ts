import type { NextResponse } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE, decodeJwt } from "./api";

const SECURE = process.env.NODE_ENV === "production";

function expiryOf(token: string): Date | undefined {
  const exp = decodeJwt(token)?.exp;
  return typeof exp === "number" ? new Date(exp * 1000) : undefined;
}

/** Cookie legível pelo cliente: o JS do app usa o token como Bearer na API. */
export function setAccessCookie(response: NextResponse, accessToken: string) {
  response.cookies.set(ACCESS_COOKIE, accessToken, {
    httpOnly: false,
    secure: SECURE,
    sameSite: "lax",
    path: "/",
    expires: expiryOf(accessToken),
  });
}

export function setSessionCookies(response: NextResponse, accessToken: string, refreshToken: string) {
  setAccessCookie(response, accessToken);
  response.cookies.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: SECURE,
    sameSite: "lax",
    path: "/",
    expires: expiryOf(refreshToken),
  });
}

export function clearSessionCookies(response: NextResponse) {
  response.cookies.delete(ACCESS_COOKIE);
  response.cookies.delete(REFRESH_COOKIE);
}
