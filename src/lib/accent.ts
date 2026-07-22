// Accent color system.
//
// The whole UI is styled with Tailwind `amber-*` utilities (and a handful of
// CSS-variable-driven components). To make the single "cor de destaque" setting
// recolor EVERYTHING — not just the few elements wired to `var(--accent)` — we
// derive a full 50–900 shade ramp from the chosen base color and expose each
// shade as space-separated RGB channels in a CSS variable (`--accent-<level>`).
// tailwind.config maps `amber.<level>` to `rgb(var(--accent-<level>) / <alpha>)`,
// so every existing `amber-300`, `bg-amber-300/10`, `text-amber-100`, … follows
// the accent automatically, opacity modifiers included.

export type AccentShades = Record<number, string>;

// Where each shade sits relative to the base (which is level 300): lighter
// shades mix toward white, darker shades toward black. Amounts are tuned to
// echo Tailwind's amber lightness steps so the design keeps its depth.
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

/**
 * Derive the full accent ramp from a base hex color. Returns a map of Tailwind
 * shade level → "r g b" channel string, ready for a CSS custom property.
 */
export function accentShades(baseHex: string): AccentShades {
  const [r, g, b] = parseHex(baseHex);
  const shades: AccentShades = {};
  for (const [level, toward, amount] of STOPS) {
    const target = toward === "white" ? 255 : 0;
    shades[level] = `${mixChannel(r, target, amount)} ${mixChannel(g, target, amount)} ${mixChannel(b, target, amount)}`;
  }
  return shades;
}

/** Apply the accent (base hex + derived shade channels) to a root element. */
export function applyAccent(root: HTMLElement, baseHex: string): void {
  root.style.setProperty("--accent", baseHex);
  const shades = accentShades(baseHex);
  for (const level of Object.keys(shades)) {
    root.style.setProperty(`--accent-${level}`, shades[Number(level)]);
  }
}
