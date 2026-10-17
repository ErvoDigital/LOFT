import { useState, useEffect } from "react";
import { Check, Moon, Plus, Sun, Monitor, RotateCcw, Sparkles, CheckCircle2 } from "lucide-react";
import { useTheme } from "../../context/ThemeContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import * as usersApi from "../../api/users.js";
import { ACCENT_PRESETS, DEFAULT_ACCENT, accentSeed, paletteFor } from "../../lib/palette.js";
import { isValidHex } from "../../lib/colors.js";

const MODES = [
  { value: "light", label: "Light", Icon: Sun, desc: "Bright and crisp appearance" },
  { value: "dark", label: "Dark", Icon: Moon, desc: "Easy on the eyes in low light" },
  { value: "system", label: "System", Icon: Monitor, desc: "Matches your device schedule" },
];

const PRESETS = ACCENT_PRESETS.map((p) => ({ ...p, palette: paletteFor(p.id) }));

const QUICK_SWATCHES = [
  { name: "Lime", hex: "#84CC16" },
  { name: "Cyan", hex: "#06B6D4" },
  { name: "Pink", hex: "#EC4899" },
  { name: "Gold", hex: "#EAB308" },
  { name: "Tangerine", hex: "#F97316" },
  { name: "Periwinkle", hex: "#6366F1" },
];

function brandFill(palette) {
  return `linear-gradient(135deg, rgb(${palette["brand-500"]}) 0%, rgb(${palette["brand-800"]}) 100%)`;
}

const TILE =
  "relative flex h-11 w-11 items-center justify-center rounded-2xl shadow-soft ring-offset-2 ring-offset-white transition-all dark:ring-offset-ink-900";

function selectedRing(selected) {
  return selected ? "ring-2 ring-ink-800 dark:ring-ink-100 scale-105" : "hover:scale-105 opacity-85 hover:opacity-100";
}

export default function AppearanceSettings() {
  const { theme, mode, setTheme, accent, setAccent } = useTheme();
  const { user, setUser } = useAuth();
  const isCustom = accent.startsWith("#");
  const [customInput, setCustomInput] = useState(isCustom ? accent : "#1F9B7D");
  const [syncedMsg, setSyncedMsg] = useState("");

  useEffect(() => {
    if (isCustom) setCustomInput(accent);
  }, [accent, isCustom]);

  async function persistAccountTheme(newMode, newAccent) {
    if (!user) return;
    try {
      const payload = {
        themePreference: JSON.stringify({
          mode: newMode || mode,
          accent: newAccent || accent,
        }),
      };
      const updated = await usersApi.updateProfile(payload);
      setUser(updated);
      setSyncedMsg("Saved to account");
      setTimeout(() => setSyncedMsg(""), 2500);
    } catch {
      // Offline or error — local storage still retains choice
    }
  }

  function handleModeChange(nextMode) {
    setTheme(nextMode);
    persistAccountTheme(nextMode, accent);
  }

  function handleAccentChange(nextAccent) {
    setAccent(nextAccent);
    persistAccountTheme(mode, nextAccent);
  }

  function handleCustomSubmit(e) {
    e?.preventDefault?.();
    const formatted = customInput.trim().toUpperCase();
    if (isValidHex(formatted)) {
      handleAccentChange(formatted);
    }
  }

  function handleResetDefault() {
    handleModeChange("system");
    handleAccentChange(DEFAULT_ACCENT);
  }

  return (
    <div className="card p-5 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 pb-4 dark:border-ink-700/60">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-ink-800 dark:text-ink-100">Colors & Appearance</h2>
            {syncedMsg && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/10 px-2 py-0.5 text-[11px] font-medium text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                <CheckCircle2 className="h-3 w-3" /> {syncedMsg}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
            Personalize how SyncTayo looks across buttons, highlights, badges, and glows.
          </p>
        </div>
        <button
          type="button"
          onClick={handleResetDefault}
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 px-2.5 py-1 text-xs font-medium text-ink-600 transition-colors hover:bg-ink-50 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
          title="Reset to default theme"
        >
          <RotateCcw className="h-3 w-3" /> Reset default
        </button>
      </div>

      {/* Mode Selector */}
      <div>
        <label className="mb-2 block text-sm font-medium text-ink-700 dark:text-ink-200">Interface Mode</label>
        <div
          role="radiogroup"
          aria-label="Interface mode"
          className="grid grid-cols-3 gap-2 sm:max-w-md"
        >
          {MODES.map(({ value, label, Icon, desc }) => {
            const selected = mode === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => handleModeChange(value)}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-center transition-all ${
                  selected
                    ? "border-brand-500 bg-brand-500/10 text-brand-700 shadow-soft ring-1 ring-brand-500 dark:bg-brand-500/15 dark:text-brand-200"
                    : "border-ink-200 bg-white/60 text-ink-600 hover:border-ink-300 hover:bg-white dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-ink-300 dark:hover:bg-white/[0.08]"
                }`}
              >
                <Icon className={`h-5 w-5 ${selected ? "text-brand-600 dark:text-brand-300" : "text-ink-400"}`} />
                <span className="text-xs font-semibold">{label}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-ink-400">
          Currently resolved to <span className="font-semibold capitalize text-ink-700 dark:text-ink-200">{theme} mode</span>.
        </p>
      </div>

      {/* Theme Accent Presets */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium text-ink-700 dark:text-ink-200">Theme Accent Color</label>
          <span className="text-xs text-ink-400">12 curated palettes + custom</span>
        </div>
        <div role="radiogroup" aria-label="Theme accent color" className="grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-7">
          {PRESETS.map((p) => {
            const selected = accent === p.id;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => handleAccentChange(p.id)}
                className="group flex flex-col items-center gap-1.5 rounded-xl p-1 focus-visible:outline-none"
              >
                <span className={`${TILE} ${selectedRing(selected)}`} style={{ backgroundImage: brandFill(p.palette) }}>
                  {selected && <Check className="h-4 w-4 text-white drop-shadow-sm" strokeWidth={3} />}
                </span>
                <span
                  className={`text-[11px] truncate max-w-full ${
                    selected ? "font-bold text-ink-900 dark:text-ink-50" : "text-ink-500 dark:text-ink-400"
                  }`}
                >
                  {p.name}
                </span>
              </button>
            );
          })}

          {/* Custom Color Trigger */}
          <label className="group relative flex cursor-pointer flex-col items-center gap-1.5 p-1">
            <input
              type="color"
              value={accentSeed(accent).toLowerCase()}
              onChange={(e) => handleAccentChange(e.target.value.toUpperCase())}
              aria-label="Custom theme color picker"
              className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
            <span
              className={`${TILE} ${selectedRing(isCustom)} pointer-events-none`}
              style={{
                backgroundImage: isCustom
                  ? brandFill(paletteFor(accent))
                  : "conic-gradient(from 200deg, #e0457b, #e07a2e, #c9a227, #3f9b5a, #1f9b7d, #2479c9, #8b55d6, #e0457b)",
              }}
            >
              {isCustom ? (
                <Check className="h-4 w-4 text-white drop-shadow-sm" strokeWidth={3} />
              ) : (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-ink-800 shadow-sm">
                  <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                </span>
              )}
            </span>
            <span
              className={`text-[11px] truncate ${
                isCustom ? "font-bold text-ink-900 dark:text-ink-50" : "text-ink-500 dark:text-ink-400"
              }`}
            >
              Custom
            </span>
          </label>
        </div>
      </div>

      {/* Custom Color Input & Harmony Presets */}
      <div className="rounded-xl border border-ink-200/80 bg-ink-50/60 p-4 dark:border-white/[0.08] dark:bg-white/[0.03]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex items-center">
            <input
              type="color"
              value={isValidHex(customInput) ? customInput : "#1F9B7D"}
              onChange={(e) => {
                const hex = e.target.value.toUpperCase();
                setCustomInput(hex);
                handleAccentChange(hex);
              }}
              className="h-9 w-9 cursor-pointer rounded-lg border-0 bg-transparent p-0"
              title="Pick color"
            />
          </div>
          <form onSubmit={handleCustomSubmit} className="flex items-center gap-2">
            <div className="relative">
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="#1F9B7D"
                maxLength={7}
                className="input h-9 w-28 font-mono text-xs uppercase"
              />
            </div>
            <button
              type="submit"
              disabled={!isValidHex(customInput) || customInput === accent}
              className="btn-secondary h-9 text-xs px-3 disabled:opacity-50"
            >
              Apply Hex
            </button>
          </form>

          {/* Quick Swatches */}
          <div className="ml-auto flex items-center gap-1.5 max-sm:w-full max-sm:pt-2">
            <span className="text-[11px] text-ink-400 mr-1">Quick shades:</span>
            {QUICK_SWATCHES.map((s) => (
              <button
                key={s.hex}
                type="button"
                onClick={() => {
                  setCustomInput(s.hex);
                  handleAccentChange(s.hex);
                }}
                title={s.name}
                style={{ backgroundColor: s.hex }}
                className={`h-6 w-6 rounded-full transition-transform hover:scale-110 ${
                  accent === s.hex ? "ring-2 ring-ink-900 ring-offset-2 dark:ring-white" : ""
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Live Interactive Preview Sandbox */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium text-ink-700 dark:text-ink-200 flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-brand-600 dark:text-brand-300" /> Live Theme Sandbox
          </label>
          <span className="text-xs text-ink-400">Real-time styling preview</span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-ink-200/80 bg-white/70 p-4 shadow-glass backdrop-blur-md dark:border-white/[0.08] dark:bg-ink-900/60 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 pb-3 dark:border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              <span className="brand-mark flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold text-white shadow-glow-sm">
                S
              </span>
              <div>
                <p className="text-xs font-semibold text-ink-900 dark:text-ink-50">SyncTayo Theme Preview</p>
                <p className="text-[11px] text-ink-400">Accent: {isCustom ? customInput : accent}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="chip">Active Tag</span>
              <span className="rounded-md bg-brand-500/10 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                100% Contrast
              </span>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 rounded-xl bg-ink-50/50 p-3 dark:bg-white/[0.03]">
              <p className="text-xs font-medium text-ink-600 dark:text-ink-300">Button Styles</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary text-xs py-1.5 px-3">
                  Primary Action
                </button>
                <button type="button" className="btn-secondary text-xs py-1.5 px-3">
                  Secondary
                </button>
              </div>
            </div>

            <div className="space-y-2 rounded-xl bg-ink-50/50 p-3 dark:bg-white/[0.03]">
              <p className="text-xs font-medium text-ink-600 dark:text-ink-300">Active Navigation & Rings</p>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500/20 to-brand-500/[0.04] px-2.5 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-400/30 dark:from-brand-500/25 dark:to-brand-800/10 dark:text-brand-300">
                  <Check className="h-3 w-3" /> Selected Item
                </div>
                <div className="h-6 w-6 rounded-full bg-brand-500 shadow-glow-sm" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
