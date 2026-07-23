// Mede as principais rotas após entrar com a conta principal e compara o cache.
// Uso: node scripts/perf-measure.mjs [baseUrl] [passes]
import "dotenv/config";

const BASE = process.argv[2] || "http://localhost:3000";
const PASSES = Number(process.argv[3] || 3);
const ROUTES = ["/", "/discover", "/roulette", "/play", "/diary"];

const jar = new Map();

function storeCookies(res) {
  const cookies = res.headers.getSetCookie?.() ?? [];
  for (const cookie of cookies) {
    const [pair] = cookie.split(";");
    const idx = pair.indexOf("=");
    if (idx < 0) continue;
    const name = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (!value) jar.delete(name);
    else jar.set(name, value);
  }
}

function cookieHeader() {
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    ...options,
    headers: { ...(options.headers || {}), cookie: cookieHeader() },
    redirect: "manual",
  });
  storeCookies(res);
  return res;
}

async function login() {
  const username = process.env.APP_OWNER_USERNAME?.trim();
  const password = process.env.APP_OWNER_PASSWORD;
  if (!username || !password) throw new Error("owner credentials not in env");

  const csrfRes = await request("/api/auth/csrf");
  const { csrfToken } = await csrfRes.json();

  const body = new URLSearchParams({ csrfToken, username, password, redirect: "false" });
  const res = await request("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (res.status >= 400) throw new Error(`login failed: HTTP ${res.status}`);
  const hasSession = [...jar.keys()].some((name) => name.includes("session-token"));
  if (!hasSession) throw new Error(`no session cookie after login (status ${res.status})`);
  console.log("login OK");
}

async function timeRoute(path) {
  const start = performance.now();
  const res = await request(path);
  const ttfb = performance.now() - start;
  const html = await res.text();
  const total = performance.now() - start;
  return { status: res.status, ttfb, total, kb: (html.length / 1024).toFixed(0) };
}

await login();
for (let pass = 1; pass <= PASSES; pass++) {
  console.log(`--- pass ${pass} ---`);
  for (const route of ROUTES) {
    const t = await timeRoute(route);
    console.log(
      `${route.padEnd(11)} status=${t.status} ttfb=${String(Math.round(t.ttfb)).padStart(6)}ms total=${String(Math.round(t.total)).padStart(6)}ms html=${t.kb}kB`,
    );
  }
}
