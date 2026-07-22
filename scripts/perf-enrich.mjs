// Perf harness: times the background enrich POST that <BackgroundEnrich/>
// fires after every dashboard paint, to see how much server work each
// navigation triggers and whether the sweep converges (requested should drop
// to 0 on repeat calls thanks to the no-change cooldown).
// Usage: node scripts/perf-enrich.mjs [baseUrl] [passes]
import "dotenv/config";

const BASE = process.argv[2] || "http://localhost:3000";
const PASSES = Number(process.argv[3] || 3);

const jar = new Map();

function storeCookies(res) {
  for (const cookie of res.headers.getSetCookie?.() ?? []) {
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

const csrfRes = await request("/api/auth/csrf");
const { csrfToken } = await csrfRes.json();
const body = new URLSearchParams({
  csrfToken,
  username: process.env.APP_OWNER_USERNAME?.trim() ?? "",
  password: process.env.APP_OWNER_PASSWORD ?? "",
  redirect: "false",
});
await request("/api/auth/callback/credentials", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: body.toString(),
});
if (![...jar.keys()].some((name) => name.includes("session-token"))) throw new Error("login failed");
console.log("login OK");

for (let pass = 1; pass <= PASSES; pass++) {
  const start = performance.now();
  const res = await request("/api/movies/enrich", {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ limit: 12 }),
  });
  const data = await res.json();
  console.log(`enrich #${pass}: status=${res.status} ${Math.round(performance.now() - start)}ms →`, data);
}
