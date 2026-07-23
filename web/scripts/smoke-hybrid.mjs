// Teste rápido do Cine-Detetive usando a API real.
// Uso: inicie o app e rode `node scripts/smoke-hybrid.mjs [baseUrl]`.
import "dotenv/config";

const BASE = process.argv[2] || "http://localhost:3000";
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
const cookieHeader = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
async function request(path, options = {}) {
  const res = await fetch(BASE + path, { ...options, headers: { ...(options.headers || {}), cookie: cookieHeader() }, redirect: "manual" });
  storeCookies(res);
  return res;
}
async function post(path, body) {
  const res = await request(path, { method: "POST", headers: { "content-type": "application/json", origin: BASE }, body: JSON.stringify(body) });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

let failures = 0;
function check(label, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

// Login
const { csrfToken } = await (await request("/api/auth/csrf")).json();
await request("/api/auth/callback/credentials", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ csrfToken, username: process.env.APP_OWNER_USERNAME?.trim() ?? "", password: process.env.APP_OWNER_PASSWORD ?? "", redirect: "false" }).toString(),
});
if (![...jar.keys()].some((k) => k.includes("session-token"))) throw new Error("login failed");

// Página abre
const page = await request("/play");
const pageHtml = await page.text();
check("GET /play renders the new game", page.status === 200 && pageHtml.includes("Cine-Detetive"));

// Rodada popular
const round = await post("/api/play/round", { source: "popular", excludeIds: [] });
check("round built (popular)", round.status === 200 && !!round.data.token, `status ${round.status}`);
check("round starts with exactly 1 actor", round.data.actors?.length === 1 && !!round.data.actors[0].name, JSON.stringify(round.data.actors?.map((a) => a.name)));
check("round exposes maxGuesses=10", round.data.maxGuesses === 10);
const token = round.data.token;

// Busca inclui o ID do TMDB
const search = await request(`/api/play/search?q=titanic&source=popular`);
const searchData = await search.json();
const wrongPick = (searchData.suggestions ?? [])[0];
check("search suggestions carry tmdbId", !!wrongPick?.tmdbId, JSON.stringify(wrongPick));

// Erro no primeiro palpite libera comparações e a próxima pista
const wrong = await post("/api/play/guess", { token, action: "guess", tmdbId: wrongPick.tmdbId, guessNumber: 1 });
check("wrong guess graded with 6 tiles", wrong.status === 200 && wrong.data.correct === false && Object.keys(wrong.data.tiles ?? {}).length === 6, JSON.stringify(Object.keys(wrong.data.tiles ?? {})));
check("next clue is a new actor, poster still hidden", !!wrong.data.next?.actor?.name && wrong.data.next?.poster === null, JSON.stringify(wrong.data.next));
check("hints still locked at guess 2", wrong.data.next?.hints?.keywords === false && wrong.data.next?.hints?.tagline === false);

// Dica bloqueada é recusada
const lockedHint = await post("/api/play/guess", { token, action: "hint", hint: 1, guessNumber: 2 });
check("locked hint returns 403", lockedHint.status === 403, `status ${lockedHint.status}`);

// Dica liberada no quinto palpite
const hint = await post("/api/play/guess", { token, action: "hint", hint: 1, guessNumber: 5 });
check("keywords hint unlocks at guess 5", hint.status === 200 && Array.isArray(hint.data.keywords), JSON.stringify(hint.data));

// Pôster aparece a partir do sétimo palpite
const wrong6 = await post("/api/play/guess", { token, action: "guess", tmdbId: wrongPick.tmdbId, guessNumber: 6 });
check("poster arrives for guess 7 (heavy)", wrong6.data.next?.poster?.stage === "heavy", JSON.stringify(wrong6.data.next?.poster));

// Desistência e vitória com o mesmo token sem estado
const reveal = await post("/api/play/guess", { token, action: "giveup", guessNumber: 7 });
check("giveup reveals the answer", reveal.status === 200 && !!reveal.data.answer?.tmdbId, reveal.data.answer?.title);
const win = await post("/api/play/guess", { token, action: "guess", tmdbId: reveal.data.answer.tmdbId, guessNumber: 3 });
check("guessing the answer wins with all-exact tiles", win.data.correct === true && win.data.tiles?.year?.grade === "exact" && win.data.tiles?.cast?.grade === "exact", JSON.stringify({ year: win.data.tiles?.year, cast: win.data.tiles?.cast }));

// Fim dos palpites revela a resposta
const last = await post("/api/play/guess", { token, action: "guess", tmdbId: wrongPick.tmdbId, guessNumber: 10 });
check("guess 10 wrong → gameOver + answer", last.data.gameOver === true && !!last.data.answer, "");

// Duas rodadas diárias usam o mesmo filme
const daily1 = await post("/api/play/round", { source: "daily", excludeIds: [] });
const daily2 = await post("/api/play/round", { source: "daily", excludeIds: [] });
const answer1 = (await post("/api/play/guess", { token: daily1.data.token, action: "giveup", guessNumber: 1 })).data.answer;
const answer2 = (await post("/api/play/guess", { token: daily2.data.token, action: "giveup", guessNumber: 1 })).data.answer;
check("daily rounds are deterministic today", !!answer1?.tmdbId && answer1.tmdbId === answer2?.tmdbId, `${answer1?.title} (${answer1?.tmdbId}) vs ${answer2?.title} (${answer2?.tmdbId})`);
check("daily round exposes dayKey", typeof daily1.data.dayKey === "string" && daily1.data.dayKey.length === 10, daily1.data.dayKey);

// Pontuação fica salva
const score = await post("/api/play/score", { source: "popular", score: 750, rounds: 3 });
check("score accepted for game=hybrid", score.status === 200 && typeof score.data.bestScore === "number", JSON.stringify(score.data));

process.exit(failures ? 1 : 0);
