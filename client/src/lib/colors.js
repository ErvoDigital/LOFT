// LOFT's brand is deep emerald now, but avatar, workspace, conversation and
// status colors saved under earlier palettes (blue, then a brighter mint) are
// still in the database. Swap those for palette counterparts at render time
// so every identity color stays on-brand, without rewriting stored rows.
export const BRAND_COLOR = "#134A3C";

const LEGACY_COLORS = {
  "#4f46e5": "#134A3C",
  "#5b5bd6": "#134A3C",
  "#3b6ff6": "#134A3C",
  "#17bc95": "#134A3C",
  "#3d8bfd": "#1F9B7D",
  "#0ea5e9": "#1F9B7D",
  "#4f6b8c": "#1F9B7D",
  "#0a7862": "#1F9B7D",
  "#64748b": "#8EA39D",
};

export function displayColor(color) {
  if (!color) return BRAND_COLOR;
  return LEGACY_COLORS[color.toLowerCase()] || color;
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Initials sit directly on these fills, and light text fails contrast on the
// brighter ones (mint, amber) — pick whichever of the palette's near-black
// background or heading white reads better.
const DARK_TEXT = "#0A0F0D";
const LIGHT_TEXT = "#F4F7F6";

export function textOn(color) {
  const hex = displayColor(color);
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return LIGHT_TEXT;
  const l = luminance(hex);
  const onDark = (l + 0.05) / (luminance(DARK_TEXT) + 0.05);
  const onLight = (luminance(LIGHT_TEXT) + 0.05) / (l + 0.05);
  return onDark > onLight ? DARK_TEXT : LIGHT_TEXT;
}
