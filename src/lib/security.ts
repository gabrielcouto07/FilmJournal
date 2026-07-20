import { NextResponse } from "next/server";

/**
 * CSRF hardening for cookie-authenticated, state-changing routes: browsers
 * always send an Origin header on cross-site requests that attach cookies, so a
 * mismatched Origin means a foreign page is driving the request. Requests
 * without an Origin (same-origin GET-initiated, curl, native clients) pass —
 * those cannot silently reuse a victim's session cookie.
 */
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
