// Gera a escala de tons usada pelas classes `amber-*` a partir da cor escolhida.

export type AccentShades = Record<number, string>;

// Tons claros misturam branco; tons escuros misturam preto.
const STOPS: Array<[level: number, toward: "white" | "black", amount: number]> = [
  [50, "white", 0.85],
  [100, "white", 0.72],
  [200, "white", 0.42],
  [300, "white", 0],
  [400, "black", 0.12],
  [500, "black", 0.26],
  [600, "black", 0.4],
  [700, "black", 0.53],
  [800, "black", 0.65],
  [900, "black", 0.76],
];

function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace("#", "").trim();
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixChannel(base: number, toward: number, amount: number): number {
  return Math.round(base * (1 - amount) + toward * amount);
}

/** Gera a escala de destaque no formato RGB usado pelas variáveis CSS. */
export function accentShades(baseHex: string): AccentShades {
  const [r, g, b] = parseHex(baseHex);
  const shades: AccentShades = {};
  for (const [level, toward, amount] of STOPS) {
    const target = toward === "white" ? 255 : 0;
    shades[level] = `${mixChannel(r, target, amount)} ${mixChannel(g, target, amount)} ${mixChannel(b, target, amount)}`;
  }
  return shades;
}

/** Concrete color strings (usable as SVG fill/stroke) derived from the accent. */
export function accentPalette(baseHex: string) {
  const s = accentShades(baseHex);
  return {
    base: baseHex,                 // the chosen accent (≈ level 300)
    soft: `rgb(${s[200]})`,        // lighter tint
    deep: `rgb(${s[500]})`,        // darker shade
    faint: `rgb(${s[200]} / 0.28)` // translucent tint for muted marks
  };
}

/** Aplica a cor e seus tons ao elemento raiz. */
export function applyAccent(root: HTMLElement, baseHex: string): void {
  root.style.setProperty("--accent", baseHex);
  const shades = accentShades(baseHex);
  for (const level of Object.keys(shades)) {
    root.style.setProperty(`--accent-${level}`, shades[Number(level)]);
  }
}
