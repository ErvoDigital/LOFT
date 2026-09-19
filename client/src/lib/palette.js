// LOFT's color system as data, shared by tailwind.config.js (which turns it
// into CSS variables with these values as the defaults) and the runtime theme
// switcher (which overwrites those variables with a palette derived from the
// user's chosen color). Keep this file free of browser APIs — Tailwind
// imports it under Node.

// The emerald palette the brand is built on. `ink` is the neutral scale,
// tinted toward the brand green: 950 is the page background, 900 the card
// surface, 400 the muted text and 50 the heading text on dark. In `brand`,
// 800 is the deep emerald; solid brand fills are the 500→800 gradient
// (`.brand-mark`, `.btn-primary`) with white text. 300 is the mint accent for
// icons, glow and dark-mode text — keep it off large fills. 600–700 are the
// light-mode text shades.
export const EMERALD = {
  brand: {
    50: "#EDFDF9",
    100: "#D2FAF1",
    200: "#A8F4E6",
    300: "#5EEAD4",
    400: "#3FD6BC",
    500: "#1F9B7D",
    600: "#137A64",
    700: "#0F5E4E",
    800: "#134A3C",
    900: "#0F3A30",
    950: "#0A2620",
  },
  ink: {
    50: "#F4F7F6",
    100: "#E6EDEA",
    200: "#D0DCD8",
    300: "#B4C4BF",
    400: "#8EA39D",
    500: "#5F7872",
    600: "#435A55",
    700: "#28403A",
    800: "#183029",
    900: "#102420",
    950: "#0A0F0D",
  },
  // Page and backdrop tones that fall between scale steps.
  tones: {
    page: "#EEF3F1",
    "wash-light": "#DCEEE7",
    "wash-dark": "#0F2A23",
  },
};

export const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

export const DEFAULT_ACCENT = "emerald";

// Each preset is the color its brand-500 is built around.
export const ACCENT_PRESETS = [
  { id: "emerald", name: "Emerald", seed: EMERALD.brand[500] },
  { id: "ocean", name: "Ocean", seed: "#2479C9" },
  { id: "indigo", name: "Indigo", seed: "#5660D8" },
  { id: "violet", name: "Violet", seed: "#8B55D6" },
  { id: "rose", name: "Rose", seed: "#D5487A" },
  { id: "graphite", name: "Graphite", seed: "#6B7280" },
];

const HEX = /^#[0-9a-f]{6}$/i;

// An accent is a preset id, or "#rrggbb" for a custom color.
export function isAccent(value) {
  return typeof value === "string" && (HEX.test(value) || ACCENT_PRESETS.some((p) => p.id === value));
}

export function accentSeed(accent) {
  if (HEX.test(accent)) return accent;
  return (ACCENT_PRESETS.find((p) => p.id === accent) || ACCENT_PRESETS[0]).seed;
}

// ---- OKLCH conversion (Björn Ottosson's OKLab) ------------------------------

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hexToOklch(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => toLinear(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { l: L, c: Math.hypot(A, B), h: (Math.atan2(B, A) * 180) / Math.PI };
}

function oklchToLinearRgb({ l: L, c, h }) {
  const rad = (h * Math.PI) / 180;
  const A = c * Math.cos(rad);
  const B = c * Math.sin(rad);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (rgb) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);

// Keeps lightness and hue, and gives up chroma until the color fits sRGB —
// so a vivid pick darkens or lightens into its nearest displayable shade
// rather than clipping to a different hue.
function oklchToRgb(color) {
  let rgb = oklchToLinearRgb(color);
  if (!inGamut(rgb)) {
    let lo = 0;
    let hi = color.c;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinearRgb({ ...color, c: mid }))) lo = mid;
      else hi = mid;
    }
    rgb = oklchToLinearRgb({ ...color, c: lo });
  }
  return rgb.map((v) => Math.round(toGamma(Math.min(1, Math.max(0, v))) * 255));
}

// ---- Palettes ----------------------------------------------------------------

// Space-separated channels, the form `rgb(var(--x) / <alpha-value>)` needs.
export function channels(hex) {
  return hexToRgb(hex).join(" ");
}

function entries(palette, transform) {
  const out = {};
  for (const step of STEPS) {
    out[`brand-${step}`] = transform(palette.brand[step], "brand");
    out[`ink-${step}`] = transform(palette.ink[step], "ink");
  }
  for (const [name, hex] of Object.entries(palette.tones)) out[name] = transform(hex, "ink");
  return out;
}

// The emerald palette as CSS variable values, keyed by variable name
// without the leading "--".
export function basePalette() {
  return entries(EMERALD, channels);
}

// Rebuilds every emerald step around another color: each step keeps its own
// lightness, so white-on-brand text and mint-on-dark contrast hold whatever
// the pick, while hue turns by the seed's offset from emerald and chroma
// scales by its relative saturation. Neutrals take the new hue but never get
// more saturated than emerald's, so a vivid pick still reads as tinted grey.
export function derivePalette(seedHex) {
  const seed = hexToOklch(seedHex);
  const ref = hexToOklch(EMERALD.brand[500]);
  const hueShift = seed.h - ref.h;
  const chroma = Math.min(seed.c / ref.c, 1.6);

  return entries(EMERALD, (hex, scale) => {
    const base = hexToOklch(hex);
    const c = base.c * (scale === "ink" ? Math.min(chroma, 1) : chroma);
    return oklchToRgb({ l: base.l, c, h: base.h + hueShift }).join(" ");
  });
}

export function paletteFor(accent) {
  return accent === DEFAULT_ACCENT || !isAccent(accent) ? basePalette() : derivePalette(accentSeed(accent));
}
