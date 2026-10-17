import test from "node:test";
import assert from "node:assert/strict";
import { ACCENT_PRESETS, DEFAULT_ACCENT, isAccent, paletteFor, accentSeed } from "../src/lib/palette.js";
import { AVATAR_PALETTE, displayColor, isValidHex, textOn } from "../src/lib/colors.js";

test("Palette preset suite contains 12 designer themes with valid configuration", () => {
  assert.equal(ACCENT_PRESETS.length, 12, "Should have 12 curated themes");
  const expectedIds = [
    "emerald",
    "teal",
    "ocean",
    "sky",
    "indigo",
    "violet",
    "fuchsia",
    "rose",
    "crimson",
    "coral",
    "amber",
    "graphite",
  ];
  const actualIds = ACCENT_PRESETS.map((p) => p.id);
  assert.deepEqual(actualIds, expectedIds);

  for (const preset of ACCENT_PRESETS) {
    assert.ok(preset.name, `Preset ${preset.id} must have a name`);
    assert.ok(preset.seed, `Preset ${preset.id} must have a seed color`);
    assert.ok(/^#[0-9a-f]{6}$/i.test(preset.seed), `Preset ${preset.id} seed must be a valid hex color`);
  }
});

test("isAccent accepts all 12 preset IDs and valid 6-digit hex colors, rejecting invalid formats", () => {
  assert.equal(isAccent(DEFAULT_ACCENT), true);
  for (const preset of ACCENT_PRESETS) {
    assert.equal(isAccent(preset.id), true);
  }
  assert.equal(isAccent("#FF5733"), true);
  assert.equal(isAccent("#123456"), true);
  assert.equal(isAccent("#abcdef"), true);

  // Invalids
  assert.equal(isAccent("not-a-preset"), false);
  assert.equal(isAccent("#fff"), false);
  assert.equal(isAccent("#1234567"), false);
  assert.equal(isAccent(null), false);
  assert.equal(isAccent(undefined), false);
  assert.equal(isAccent(123), false);
});

test("paletteFor generates complete CSS variable mappings for all steps", () => {
  const base = paletteFor(DEFAULT_ACCENT);
  assert.ok(base["brand-500"], "Must contain brand-500");
  assert.ok(base["brand-800"], "Must contain brand-800");
  assert.ok(base["ink-900"], "Must contain ink-900");

  const custom = paletteFor("#EA580C");
  assert.ok(custom["brand-500"], "Custom palette must generate brand-500");
  assert.ok(custom["brand-800"], "Custom palette must generate brand-800");
  assert.notEqual(custom["brand-500"], base["brand-500"], "Custom palette should differ from emerald base");
});

test("AVATAR_PALETTE provides 16 curated shades with high visual diversity", () => {
  assert.equal(AVATAR_PALETTE.length, 16);
  const hexSet = new Set();
  for (const item of AVATAR_PALETTE) {
    assert.ok(item.name, "Avatar swatch must have a name");
    assert.ok(isValidHex(item.hex), `Avatar swatch ${item.name} must have a valid hex color`);
    assert.ok(!hexSet.has(item.hex.toLowerCase()), `Duplicate swatch color detected: ${item.hex}`);
    hexSet.add(item.hex.toLowerCase());
  }
});

test("textOn accurately calculates WCAG contrast between dark and light initial text", () => {
  // Dark colors must have light text
  assert.equal(textOn("#134A3C"), "#F4F7F6");
  assert.equal(textOn("#0A0F0D"), "#F4F7F6");
  assert.equal(textOn("#102420"), "#F4F7F6");
  assert.equal(textOn("#1F2937"), "#F4F7F6");

  // Light/bright colors must have dark text for contrast
  assert.equal(textOn("#5EEAD4"), "#0A0F0D");
  assert.equal(textOn("#FFFFFF"), "#0A0F0D");
  assert.equal(textOn("#FDE047"), "#0A0F0D");
  assert.equal(textOn("#E9A23B"), "#0A0F0D");
});

test("isValidHex accepts 6-character hex strings with # and rejects bad formats", () => {
  assert.equal(isValidHex("#FFFFFF"), true);
  assert.equal(isValidHex("#ffffff"), true);
  assert.equal(isValidHex("#1F9B7D"), true);
  assert.equal(isValidHex("#123456"), true);

  assert.equal(isValidHex("1F9B7D"), false, "Missing # must fail");
  assert.equal(isValidHex("#FFF"), false, "3-digit hex must fail");
  assert.equal(isValidHex("#GGGGGG"), false, "Non-hex characters must fail");
  assert.equal(isValidHex(""), false);
  assert.equal(isValidHex(null), false);
});

test("KAS_LANGUAGES includes English as default and provides rich language support", async () => {
  const { KAS_LANGUAGES } = await import("../src/lib/languages.js");
  assert.ok(Array.isArray(KAS_LANGUAGES), "KAS_LANGUAGES must be an array");
  assert.ok(KAS_LANGUAGES.length >= 10, "Should provide at least 10 major languages");
  assert.equal(KAS_LANGUAGES[0].id, "English", "First language must be English default");
  assert.match(KAS_LANGUAGES[0].native, /Default/i, "English should be annotated as default");

  const ids = new Set();
  for (const lang of KAS_LANGUAGES) {
    assert.ok(lang.id, "Language must have an id");
    assert.ok(lang.label, "Language must have a label");
    assert.ok(lang.native, "Language must have a native title");
    assert.ok(!ids.has(lang.id), `Duplicate language id: ${lang.id}`);
    ids.add(lang.id);
  }
  assert.ok(ids.has("Filipino"), "Should support Filipino");
  assert.ok(ids.has("Spanish"), "Should support Spanish");
  assert.ok(ids.has("Japanese"), "Should support Japanese");
});


