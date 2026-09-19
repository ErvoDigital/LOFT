import { Check, Moon, Plus, Sun } from "lucide-react";
import { useTheme } from "../../context/ThemeContext.jsx";
import { ACCENT_PRESETS, accentSeed, paletteFor } from "../../lib/palette.js";

const MODES = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
];

// Each preset's swatch shows its own brand fill, computed once.
const PRESETS = ACCENT_PRESETS.map((p) => ({ ...p, palette: paletteFor(p.id) }));

function brandFill(palette) {
  return `linear-gradient(135deg, rgb(${palette["brand-500"]}) 0%, rgb(${palette["brand-800"]}) 100%)`;
}

const TILE =
  "relative flex h-11 w-11 items-center justify-center rounded-2xl shadow-soft ring-offset-2 ring-offset-white transition-transform dark:ring-offset-ink-900";

function selectedRing(selected) {
  return selected ? "ring-2 ring-ink-800 dark:ring-ink-100" : "group-hover:scale-105";
}

export default function AppearanceSettings() {
  const { theme, setTheme, accent, setAccent } = useTheme();
  const isCustom = accent.startsWith("#");

  return (
    <div className="card p-6">
      <h2 className="text-base font-semibold text-ink-800 dark:text-ink-100">Appearance</h2>
      <p className="mb-5 mt-0.5 text-xs text-ink-500 dark:text-ink-400">
        Changes apply right away and are saved on this device.
      </p>

      <p className="mb-2 text-sm font-medium text-ink-600 dark:text-ink-200">Mode</p>
      <div
        role="radiogroup"
        aria-label="Mode"
        className="inline-flex rounded-xl border border-ink-200 bg-white/60 p-1 dark:border-white/[0.08] dark:bg-white/[0.04]"
      >
        {MODES.map(({ value, label, Icon }) => {
          const selected = theme === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setTheme(value)}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                selected
                  ? "bg-white text-ink-900 shadow-soft dark:bg-white/[0.12] dark:text-ink-50"
                  : "text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-100"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </div>

      <p className="mb-0.5 mt-6 text-sm font-medium text-ink-600 dark:text-ink-200">Theme color</p>
      <p className="mb-3 text-xs text-ink-500 dark:text-ink-400">
        Colors buttons, highlights, icons and the background glow across LOFT.
      </p>
      <div role="radiogroup" aria-label="Theme color" className="flex flex-wrap gap-x-3 gap-y-4">
        {PRESETS.map((p) => {
          const selected = accent === p.id;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setAccent(p.id)}
              className="group flex w-14 flex-col items-center gap-1.5 rounded-xl focus-visible:outline-none [&:focus-visible>span:first-child]:ring-2 [&:focus-visible>span:first-child]:ring-brand-500"
            >
              <span className={`${TILE} ${selectedRing(selected)}`} style={{ backgroundImage: brandFill(p.palette) }}>
                {selected && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
              </span>
              <span
                className={`text-xs ${selected ? "font-semibold text-ink-800 dark:text-ink-100" : "text-ink-500 dark:text-ink-400"}`}
              >
                {p.name}
              </span>
            </button>
          );
        })}

        {/* The native picker sits invisibly over the tile, so the browser
            anchors its popup there and keyboard focus lands on a real input. */}
        <label className="group relative flex w-14 cursor-pointer flex-col items-center gap-1.5">
          <input
            type="color"
            value={accentSeed(accent).toLowerCase()}
            onChange={(e) => setAccent(e.target.value.toUpperCase())}
            aria-label="Custom theme color"
            className="peer absolute left-1.5 top-0 h-11 w-11 cursor-pointer opacity-0"
          />
          <span
            className={`${TILE} ${selectedRing(isCustom)} pointer-events-none peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500`}
            style={{
              backgroundImage: isCustom
                ? brandFill(paletteFor(accent))
                : "conic-gradient(from 200deg, #e0457b, #e07a2e, #c9a227, #3f9b5a, #1f9b7d, #2479c9, #8b55d6, #e0457b)",
            }}
          >
            {isCustom ? (
              <Check className="h-4 w-4 text-white" strokeWidth={3} />
            ) : (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-ink-800">
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              </span>
            )}
          </span>
          <span
            className={`text-xs ${isCustom ? "font-semibold text-ink-800 dark:text-ink-100" : "text-ink-500 dark:text-ink-400"}`}
          >
            Custom
          </span>
        </label>
      </div>

      {isCustom && (
        <p className="mt-4 text-xs text-ink-500 dark:text-ink-400">
          Built from <span className="font-mono font-medium text-ink-700 dark:text-ink-200">{accent}</span>. LOFT
          adjusts how light or dark each shade is so text on it stays readable.
        </p>
      )}
    </div>
  );
}
