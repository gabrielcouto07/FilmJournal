/** Monta o retrato de gosto em PT-BR com os sinais já calculados pelo Paladar. */

import type { Contrarian, DecadeBucket, DirectorLoyalty, GenreCount } from "./palate";

/** Mínimo de filmes avaliados para formar um retrato. */
export const MIN_RATED_FOR_VERDICT = 10;
/** Mínimo de filmes comparáveis para falar da relação com o público. */
export const MIN_LEAN_SAMPLE = 10;
/** Abaixo deste limite, a leitura é de consenso com o público. */
export const LEAN_NEUTRAL_BAND = 0.1;
/** Mínimo de filmes para uma década ou gênero definir o perfil. */
export const MIN_TRAIT_COUNT = 3;

export type VerdictInput = {
  /** Filmes avaliados usados pelo Paladar. */
  totalFilms: number;
  contrarian: Pick<Contrarian, "tasteLean" | "contrarianScore" | "sampleSize">;
  decades: DecadeBucket[];
  genres: GenreCount[];
  directors: DirectorLoyalty[];
};

/** Tons disponíveis para o texto; o padrão pode ser trocado em uma linha. */
export type VerdictVoice = "critico" | "retrato" | "manchete";
export const DEFAULT_VOICE: VerdictVoice = "critico";

export type Verdict = {
  /** Título curto do perfil ou `null` quando faltam dados. */
  headline: string | null;
  /** Texto de apoio ou `null` quando faltam dados. */
  sentence: string | null;
  /** Indica que ainda há poucos dados para formar um perfil. */
  thin: boolean;
};

/** Traduções dos gêneros recebidos do TMDB. */
const GENRE_PT: Record<string, string> = {
  Action: "ação", Adventure: "aventura", Animation: "animação", Comedy: "comédia",
  Crime: "crime", Documentary: "documentário", Drama: "drama", Family: "família",
  Fantasy: "fantasia", History: "história", Horror: "terror", Music: "música",
  Mystery: "mistério", Romance: "romance", "Science Fiction": "ficção científica",
  "TV Movie": "filmes de TV", Thriller: "suspense", War: "guerra", Western: "faroeste",
};

/** Nome do gênero em PT-BR ou o original em minúsculas. */
export function genreLabel(genre: string): string {
  return GENRE_PT[genre] ?? genre.toLowerCase();
}

type Lean = "exigente" | "generoso" | "consenso";

/** Sinais disponíveis para o texto; cada um pode ser `null`. */
type Traits = {
  lean: Lean | null;
  /** Diferença com sinal, presente quando há comparação válida. */
  leanValue: number | null;
  decade: DecadeBucket | null;
  genre: GenreCount | null;
  director: DirectorLoyalty | null;
};

function extractTraits(input: VerdictInput): Traits {
  const hasLean = input.contrarian.sampleSize >= MIN_LEAN_SAMPLE;
  const leanValue = hasLean ? input.contrarian.tasteLean : null;
  const lean: Lean | null = leanValue == null
    ? null
    : Math.abs(leanValue) < LEAN_NEUTRAL_BAND
      ? "consenso"
      : leanValue > 0
        ? "generoso"
        : "exigente";

  const decade = [...input.decades].sort((a, b) => b.count - a.count)[0] ?? null;
  const genre = input.genres[0] ?? null;

  return {
    lean,
    leanValue,
    decade: decade && decade.count >= MIN_TRAIT_COUNT ? decade : null,
    genre: genre && genre.count >= MIN_TRAIT_COUNT ? genre : null,
    // A fidelidade ao diretor já exige o mínimo de filmes.
    director: input.directors[0] ?? null,
  };
}

const star = (value: number) => `${Math.abs(value).toFixed(2)}★`;
/** Formata a década como "os anos 2000". */
const decadePhrase = (decade: DecadeBucket) => `os anos ${decade.decade}`;

/** Formata uma lista em PT-BR com "e" no último item. */
function listPt(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

function headlineFor(traits: Traits): string {
  if (traits.lean === "exigente") return "Paladar exigente.";
  if (traits.lean === "generoso") return "Paladar generoso.";
  if (traits.lean === "consenso") return "Termômetro do consenso.";
  if (traits.decade) return `Coração n${decadePhrase(traits.decade)}.`;
  if (traits.genre) return `Movido a ${genreLabel(traits.genre.genre)}.`;
  return "Seu paladar, em uma frase.";
}

/** Monta a frase sobre a diferença para o público. */
function leanClause(traits: Traits): string | null {
  if (traits.lean == null || traits.leanValue == null) return null;
  if (traits.lean === "consenso") return "suas notas andam lado a lado com o consenso";
  return traits.lean === "exigente"
    ? `você avalia ${star(traits.leanValue)} abaixo do público`
    : `você avalia ${star(traits.leanValue)} acima do público`;
}

/** Tom crítico: uma frase mais opinativa. */
function criticoSentence(traits: Traits): string {
  const identity: string[] = [];
  if (traits.decade) identity.push(`raízes fincadas n${decadePhrase(traits.decade)}`);
  if (traits.genre) identity.push(`apetite por ${genreLabel(traits.genre.genre)}`);
  if (traits.director) identity.push(`retornos constantes a ${traits.director.name} (${traits.director.count} filmes)`);

  const lean = leanClause(traits);
  const opening = traits.lean === "consenso"
    ? "Você é um termômetro do gosto médio — suas notas seguem o consenso de perto"
    : lean
      ? `Você encara o consenso de frente — ${lean}, na média`
      : "Seu arquivo já mostra um gosto com endereço próprio";

  return identity.length ? `${opening} — com ${listPt(identity)}.` : `${opening}.`;
}

/** Tom de retrato: identidade primeiro, consenso depois. */
function retratoSentence(traits: Traits): string {
  const home: string[] = [];
  if (traits.decade) home.push(`mora n${decadePhrase(traits.decade)}`);
  if (traits.genre) home.push(`vive de ${genreLabel(traits.genre.genre)}`);
  if (traits.director) home.push(`volta sempre a ${traits.director.name}`);
  const first = home.length ? `Seu gosto ${listPt(home)}.` : "Seu gosto já tem contornos claros.";

  const second = traits.lean === "consenso"
    ? "E diante do público, vocês concordam: suas notas seguem o consenso de perto."
    : traits.lean && traits.leanValue != null
      ? traits.lean === "exigente"
        ? `Diante do público, você não faz média: ${star(traits.leanValue)} abaixo do consenso.`
        : `Diante do público, você abre o coração: ${star(traits.leanValue)} acima do consenso.`
      : "";

  return second ? `${first} ${second}` : first;
}

/** Tom de manchete: título forte com uma explicação curta. */
function mancheteSentence(traits: Traits): string {
  const lean = leanClause(traits);
  const parts: string[] = [];
  if (lean) {
    parts.push(
      traits.lean === "consenso"
        ? "O público costuma concordar com você — suas notas seguem o consenso de perto"
        : traits.lean === "exigente"
          ? `O público raramente te convence — ${lean}`
          : `O público costuma sair ganhando — ${lean}`,
    );
  }
  if (traits.director) parts.push(`${traits.director.name} é o diretor a que você sempre volta (${traits.director.count} filmes)`);
  if (!parts.length && traits.decade) parts.push(`seu território é ${decadePhrase(traits.decade)}`);
  if (!parts.length && traits.genre) parts.push(`${genreLabel(traits.genre.genre)} é o seu território`);
  if (!parts.length) return "Seu arquivo já mostra um gosto com endereço próprio.";
  const sentence = parts.join(", e ");
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}

function mancheteHeadline(traits: Traits): string {
  const chips: string[] = [];
  if (traits.lean === "exigente") chips.push("Exigente");
  if (traits.lean === "generoso") chips.push("Generoso");
  if (traits.lean === "consenso") chips.push("Em sintonia com o público");
  if (traits.decade) chips.push(`anos ${traits.decade.decade}`);
  if (traits.genre) chips.push(`movido a ${genreLabel(traits.genre.genre)}`);
  return chips.length ? `${chips.join(", ")}.` : headlineFor(traits);
}

/** Retorna um retrato vazio quando ainda não há sinais suficientes. */
export function computeVerdict(input: VerdictInput, voice: VerdictVoice = DEFAULT_VOICE): Verdict {
  const traits = extractTraits(input);
  const hasAnySignal = traits.lean != null || traits.decade != null || traits.genre != null || traits.director != null;
  if (input.totalFilms < MIN_RATED_FOR_VERDICT || !hasAnySignal) {
    return { headline: null, sentence: null, thin: true };
  }

  if (voice === "retrato") return { headline: headlineFor(traits), sentence: retratoSentence(traits), thin: false };
  if (voice === "manchete") return { headline: mancheteHeadline(traits), sentence: mancheteSentence(traits), thin: false };
  return { headline: headlineFor(traits), sentence: criticoSentence(traits), thin: false };
}
