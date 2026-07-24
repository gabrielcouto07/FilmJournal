/** Encontra temas recorrentes nas palavras-chave dos filmes mais bem avaliados. */

import { round } from "./palate.js";

/** Mínimo de filmes bem avaliados para gerar temas. */
export const MIN_HIGHLY_RATED = 8;
/** Quantas vezes uma palavra-chave precisa aparecer para virar tema. */
export const MIN_MOTIF_COUNT = 3;
/** Mínimo de temas para montar uma frase útil. */
export const MIN_MOTIFS = 2;
/** Quantos temas aparecem na frase. */
export const MOTIF_LIMIT = 3;

/** Filme avaliado com suas palavras-chave do TMDB. */
export type MotifFilm = {
  /** Nota do usuário entre 0 e 5. */
  userRating: number;
  keywords: string[];
};

export type Motif = { keyword: string; label: string; count: number };

export type MotifSummary = {
  /** Corte usado para considerar um filme bem avaliado. */
  threshold: number;
  highlyRatedCount: number;
  motifs: Motif[];
  /** Frase do painel ou `null` quando faltam dados. */
  sentence: string | null;
};

/** Palavras genéricas que não dizem muito sobre o gosto do usuário. */
const STOPLIST = new Set(
  [
    // Cenas após os créditos
    "aftercreditsstinger", "duringcreditsstinger", "aftercreditsscene", "duringcreditsscene", "postcreditsscene",
    // Origem da obra
    "based on novel or book", "based on novel", "based on book", "based on comic", "based on comic book",
    "based on young adult novel", "based on true story", "based on a true story", "based on real events",
    "based on video game", "based on manga", "based on tv series", "based on play or musical",
    "based on short story", "based on toy", "live action remake", "live action adaptation",
    // Dados de produção
    "woman director", "sequel", "prequel", "remake", "reboot", "spin off", "spinoff", "franchise",
    "independent film", "3d", "3d animation", "imax", "anthology", "short film", "found footage",
    // Adjetivos genéricos do TMDB
    "adoring", "amused", "angry", "anxious", "bold", "calm", "cheerful", "comforting", "complex",
    "curious", "dramatic", "empowering", "energetic", "enthusiastic", "excited", "feel good",
    "gripping", "intense", "lighthearted", "playful", "romantic", "suspenseful", "tender",
    "thoughtful", "uplifting", "whimsical",
  ].map((keyword) => keyword.replace(/[\s-]+/g, "")),
);

/** Traduções comuns; termos desconhecidos mantêm o nome original. */
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

/** Nome em PT-BR quando houver tradução. */
export function keywordLabel(keyword: string): string {
  return KEYWORD_PT[normalize(keyword)] ?? normalize(keyword);
}

/** Usa o quartil superior das notas, limitado a 4,5 estrelas. */
export function highlyRatedThreshold(ratings: number[]): number {
  if (!ratings.length) return 4.5;
  const sorted = [...ratings].sort((a, b) => a - b);
  const q3 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.75))];
  return round(Math.min(4.5, q3), 1);
}

/** Conta temas nos filmes mais bem avaliados. */
export function computeMotifs(films: MotifFilm[], limit = MOTIF_LIMIT): Motif[] {
  const threshold = highlyRatedThreshold(films.map((film) => film.userRating));
  const top = films.filter((film) => film.userRating >= threshold);
  if (top.length < MIN_HIGHLY_RATED) return [];

  const counts = new Map<string, number>();
  for (const film of top) {
    // Cada palavra-chave conta uma vez por filme.
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

/** Formata uma lista em PT-BR com "e" no último item. */
function listPt(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

/** Monta o resumo completo ou retorna frase vazia quando faltam dados. */
export function computeMotifSummary(films: MotifFilm[]): MotifSummary {
  const threshold = highlyRatedThreshold(films.map((film) => film.userRating));
  const highlyRatedCount = films.filter((film) => film.userRating >= threshold).length;
  const motifs = computeMotifs(films);
  const sentence = motifs.length >= MIN_MOTIFS
    ? `Seus favoritos voltam sempre a: ${listPt(motifs.map((motif) => motif.label))}.`
    : null;
  return { threshold, highlyRatedCount, motifs, sentence };
}
