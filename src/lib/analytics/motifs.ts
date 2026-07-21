/**
 * Recurring motifs — pure, Prisma-free frequency analysis over the TMDB
 * keywords of the viewer's highly-rated films. No ML: a plain count with a
 * stoplist for generic production keywords, surfaced as one evocative pt-BR
 * sentence on /dashboard. The Prisma read lives in the data layer
 * (`getMotifsData` in src/lib/data.ts).
 */

import { round } from "./palate";

/** Need at least this many highly-rated films for motifs to mean anything. */
export const MIN_HIGHLY_RATED = 8;
/** A keyword must recur across this many highly-rated films to be a motif. */
export const MIN_MOTIF_COUNT = 3;
/** Need at least this many motifs to say something evocative. */
export const MIN_MOTIFS = 2;
/** How many motifs the sentence names. */
export const MOTIF_LIMIT = 3;

/** One rated film with its TMDB keyword names. */
export type MotifFilm = {
  /** Viewer rating on the 0–5 scale (callers filter nulls). */
  userRating: number;
  keywords: string[];
};

export type Motif = { keyword: string; label: string; count: number };

export type MotifSummary = {
  /** Rating cutoff used for "highly rated" (top quartile, capped at 4.5★). */
  threshold: number;
  highlyRatedCount: number;
  motifs: Motif[];
  /** The dashboard sentence, or null when the data is too thin to show. */
  sentence: string | null;
};

/**
 * Generic keywords that say nothing about taste: credits stingers, provenance
 * ("based on ..."), production metadata and TMDB's mood adjectives. Keys are
 * lowercase with spaces/hyphens stripped, so "aftercredits scene" and
 * "aftercreditsscene" both match.
 */
const STOPLIST = new Set(
  [
    // credits stingers
    "aftercreditsstinger", "duringcreditsstinger", "aftercreditsscene", "duringcreditsscene", "postcreditsscene",
    // provenance
    "based on novel or book", "based on novel", "based on book", "based on comic", "based on comic book",
    "based on young adult novel", "based on true story", "based on a true story", "based on real events",
    "based on video game", "based on manga", "based on tv series", "based on play or musical",
    "based on short story", "based on toy", "live action remake", "live action adaptation",
    // production metadata
    "woman director", "sequel", "prequel", "remake", "reboot", "spin off", "spinoff", "franchise",
    "independent film", "3d", "3d animation", "imax", "anthology", "short film", "found footage",
    // TMDB mood adjectives
    "adoring", "amused", "angry", "anxious", "bold", "calm", "cheerful", "comforting", "complex",
    "curious", "dramatic", "empowering", "energetic", "enthusiastic", "excited", "feel good",
    "gripping", "intense", "lighthearted", "playful", "romantic", "suspenseful", "tender",
    "thoughtful", "uplifting", "whimsical",
  ].map((keyword) => keyword.replace(/[\s-]+/g, "")),
);

/**
 * pt-BR labels for frequent TMDB keywords, so the sentence reads naturally.
 * Unknown keywords fall back to their raw (English) name — still a real motif.
 */
const KEYWORD_PT: Record<string, string> = {
  "new york city": "Nova York",
  "los angeles, california": "Los Angeles",
  "london, england": "Londres",
  "paris, france": "Paris",
  "tokyo, japan": "Tóquio",
  friendship: "amizade",
  superhero: "super-heróis",
  dystopia: "distopia",
  magic: "magia",
  villain: "vilões",
  "dying and death": "morte",
  "dark comedy": "comédia sombria",
  "loss of loved one": "a perda de um ente querido",
  sports: "esporte",
  investigation: "investigação",
  "female protagonist": "protagonistas femininas",
  "psychological thriller": "suspense psicológico",
  witch: "bruxas",
  vigilante: "justiceiros",
  "father daughter relationship": "relações entre pai e filha",
  "father son relationship": "relações entre pai e filho",
  "mother daughter relationship": "relações entre mãe e filha",
  "mother son relationship": "relações entre mãe e filho",
  "time travel": "viagem no tempo",
  love: "amor",
  murder: "assassinato",
  revenge: "vingança",
  memory: "memória",
  isolation: "isolamento",
  loneliness: "solidão",
  "coming of age": "amadurecimento",
  "high school": "ensino médio",
  "small town": "cidades pequenas",
  "road trip": "viagens de estrada",
  robot: "robôs",
  space: "espaço",
  alien: "alienígenas",
  "artificial intelligence (a.i.)": "inteligência artificial",
  war: "guerra",
  "world war ii": "a Segunda Guerra Mundial",
  "serial killer": "serial killers",
  heist: "assaltos",
  gangster: "gângsteres",
  mafia: "máfia",
  zombie: "zumbis",
  vampire: "vampiros",
  ghost: "fantasmas",
  "haunted house": "casas mal-assombradas",
  "post-apocalyptic future": "futuros pós-apocalípticos",
  "dysfunctional family": "famílias disfuncionais",
  "family relationships": "relações familiares",
  marriage: "casamento",
  divorce: "divórcio",
  infidelity: "infidelidade",
  christmas: "Natal",
  musical: "musicais",
  dancing: "dança",
  music: "música",
  boxing: "boxe",
  basketball: "basquete",
  soccer: "futebol",
  courtroom: "tribunais",
  prison: "prisão",
  kidnapping: "sequestros",
  survival: "sobrevivência",
  dream: "sonhos",
  multiverse: "multiverso",
  "marvel cinematic universe (mcu)": "o universo Marvel",
  spy: "espionagem",
  assassin: "assassinos",
  "martial arts": "artes marciais",
  samurai: "samurais",
  western: "faroeste",
  "love triangle": "triângulos amorosos",
  "forbidden love": "amor proibido",
  secret: "segredos",
  betrayal: "traição",
  corruption: "corrupção",
  politics: "política",
  journalism: "jornalismo",
  addiction: "vício",
  "mental illness": "saúde mental",
  depression: "depressão",
  grief: "luto",
  redemption: "redenção",
  religion: "religião",
  cult: "seitas",
  conspiracy: "conspirações",
  "neo-noir": "neo-noir",
  nostalgia: "nostalgia",
  "time loop": "loops temporais",
  wedding: "casamentos",
  "fish out of water": "peixes fora d'água",
};

function normalize(keyword: string): string {
  return keyword.trim().toLowerCase();
}

export function isStopKeyword(keyword: string): boolean {
  return STOPLIST.has(normalize(keyword).replace(/[\s-]+/g, ""));
}

/** pt-BR display label for a keyword (falls back to the raw name). */
export function keywordLabel(keyword: string): string {
  return KEYWORD_PT[normalize(keyword)] ?? normalize(keyword);
}

/**
 * The "highly rated" cutoff: the top quartile of the viewer's ratings, capped
 * at 4.5★ so a strict rater with few 5★ films still gets a motif universe.
 */
export function highlyRatedThreshold(ratings: number[]): number {
  if (!ratings.length) return 4.5;
  const sorted = [...ratings].sort((a, b) => a - b);
  const q3 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.75))];
  return round(Math.min(4.5, q3), 1);
}

/** Frequency-count motifs across the viewer's highly-rated films. */
export function computeMotifs(films: MotifFilm[], limit = MOTIF_LIMIT): Motif[] {
  const threshold = highlyRatedThreshold(films.map((film) => film.userRating));
  const top = films.filter((film) => film.userRating >= threshold);
  if (top.length < MIN_HIGHLY_RATED) return [];

  const counts = new Map<string, number>();
  for (const film of top) {
    // A keyword counts once per film, however many times TMDB repeats it.
    const seen = new Set<string>();
    for (const raw of film.keywords) {
      const keyword = normalize(raw);
      if (!keyword || seen.has(keyword) || isStopKeyword(keyword)) continue;
      seen.add(keyword);
      counts.set(keyword, (counts.get(keyword) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= MIN_MOTIF_COUNT)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([keyword, count]) => ({ keyword, label: keywordLabel(keyword), count }));
}

/** "a, b e c" — pt-BR list with a final "e". */
function listPt(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

/** The whole motif view in one call. `sentence` is null when too thin to show. */
export function computeMotifSummary(films: MotifFilm[]): MotifSummary {
  const threshold = highlyRatedThreshold(films.map((film) => film.userRating));
  const highlyRatedCount = films.filter((film) => film.userRating >= threshold).length;
  const motifs = computeMotifs(films);
  const sentence = motifs.length >= MIN_MOTIFS
    ? `Seus favoritos voltam sempre a: ${listPt(motifs.map((motif) => motif.label))}.`
    : null;
  return { threshold, highlyRatedCount, motifs, sentence };
}
