import { createContext, useContext, useEffect, useLayoutEffect, useState } from "react";
import { DEFAULT_ACCENT, basePalette, isAccent, paletteFor } from "../lib/palette.js";

const ThemeContext = createContext(null);
const THEME_KEY = "loft-theme";
const ACCENT_KEY = "loft-accent";

function getInitialTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // localStorage unavailable — fall through to system preference.
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getInitialAccent() {
  try {
    const stored = localStorage.getItem(ACCENT_KEY);
    if (isAccent(stored)) return stored;
  } catch {
    // localStorage unavailable — use the default brand color.
  }
  return DEFAULT_ACCENT;
}

const DEFAULT_FAVICON = document.querySelector("link[rel='icon']")?.getAttribute("href");

// The tab icon is the brand gradient, so it follows the theme color too.
function applyFavicon(accent, palette) {
  const link = document.querySelector("link[rel='icon']");
  if (!link) return;
  if (accent === DEFAULT_ACCENT) {
    if (DEFAULT_FAVICON) link.setAttribute("href", DEFAULT_FAVICON);
    return;
  }
  const rgb = (key) => `rgb(${palette[key].replaceAll(" ", ",")})`;
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
    `<stop offset='0' stop-color='${rgb("brand-500")}'/><stop offset='1' stop-color='${rgb("brand-800")}'/></linearGradient></defs>` +
    `<rect width='32' height='32' rx='7' fill='url(#g)'/><text x='16' y='22' font-family='Arial, sans-serif' font-size='17' ` +
    `font-weight='700' fill='#F4F7F6' text-anchor='middle'>L</text></svg>`;
  link.setAttribute("href", `data:image/svg+xml,${encodeURIComponent(svg)}`);
}

// The theme color is a set of CSS variables on <html> overriding the emerald
// defaults Tailwind writes to :root; removing them restores emerald.
function applyAccent(accent) {
  const root = document.documentElement.style;
  const palette = paletteFor(accent);
  for (const key of Object.keys(basePalette())) {
    if (accent === DEFAULT_ACCENT) root.removeProperty(`--${key}`);
    else root.setProperty(`--${key}`, palette[key]);
  }
  applyFavicon(accent, palette);
}

// App-wide light/dark mode and theme color. Mode is a plain class on <html>
// (Tailwind's `dark:` variant + the .dark overrides in styles/index.css both
// key off it); the color is the CSS variables above. Both sit at the root of
// the provider tree so they apply to the login/register screens too, not
// just the authenticated app, and both are remembered per device.
export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme);
  const [accent, setAccentState] = useState(getInitialAccent);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // localStorage unavailable — theme just won't persist across reloads.
    }
  }, [theme]);

  // Layout effect so a saved color is in place before the first paint,
  // rather than flashing emerald on every load.
  useLayoutEffect(() => {
    applyAccent(accent);
    try {
      if (accent === DEFAULT_ACCENT) localStorage.removeItem(ACCENT_KEY);
      else localStorage.setItem(ACCENT_KEY, accent);
    } catch {
      // localStorage unavailable — the color just won't persist across reloads.
    }
  }, [accent]);

  function setTheme(next) {
    setThemeState(next === "dark" ? "dark" : "light");
  }

  function toggleTheme() {
    setThemeState((t) => (t === "dark" ? "light" : "dark"));
  }

  function setAccent(next) {
    setAccentState(isAccent(next) ? next : DEFAULT_ACCENT);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, accent, setAccent }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
