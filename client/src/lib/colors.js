// LOFT's brand moved from blue to mint teal, but avatar, workspace,
// conversation and status colors saved before then are still blue hex values
// in the database. Swap those for teal counterparts at render time so nothing
// on screen stays blue, without rewriting stored rows.
export const BRAND_COLOR = "#17BC95";

const LEGACY_BLUES = {
  "#4f46e5": "#17BC95",
  "#5b5bd6": "#17BC95",
  "#3b6ff6": "#17BC95",
  "#3d8bfd": "#0A7862",
  "#0ea5e9": "#0A7862",
  "#4f6b8c": "#0A7862",
};

export function displayColor(color) {
  if (!color) return BRAND_COLOR;
  return LEGACY_BLUES[color.toLowerCase()] || color;
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Initials sit directly on these fills, and white fails contrast on the
// brighter ones (mint, amber) — pick whichever of ink-950 or white reads better.
export function textOn(color) {
  const hex = displayColor(color);
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return "#FFFFFF";
  const l = luminance(hex);
  return (l + 0.05) / (0.0036 + 0.05) > 1.05 / (l + 0.05) ? "#090B12" : "#FFFFFF";
}
