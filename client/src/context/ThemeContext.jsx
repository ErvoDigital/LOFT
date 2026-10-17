import { createContext, useContext, useEffect, useLayoutEffect, useState, useCallback } from "react";
import { DEFAULT_ACCENT, basePalette, isAccent, paletteFor } from "../lib/palette.js";

const ThemeContext = createContext(null);
const THEME_KEY = "loft-theme";
const ACCENT_KEY = "loft-accent";

function getSystemTheme() {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getInitialMode() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // localStorage unavailable
  }
  return "system";
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

const DEFAULT_FAVICON = typeof document !== "undefined" ? document.querySelector("link[rel='icon']")?.getAttribute("href") : null;

// The tab icon is the brand gradient, so it follows the theme color too.
function applyFavicon(accent, palette) {
  if (typeof document === "undefined") return;
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
    `font-weight='700' fill='#F4F7F6' text-anchor='middle'>S</text></svg>`;
  link.setAttribute("href", `data:image/svg+xml,${encodeURIComponent(svg)}`);
}

// The theme color is a set of CSS variables on <html> overriding the emerald
// defaults Tailwind writes to :root; removing them restores emerald.
function applyAccent(accent) {
  if (typeof document === "undefined") return;
  const root = document.documentElement.style;
  const palette = paletteFor(accent);
  for (const key of Object.keys(basePalette())) {
    if (accent === DEFAULT_ACCENT) root.removeProperty(`--${key}`);
    else root.setProperty(`--${key}`, palette[key]);
  }
  applyFavicon(accent, palette);
}

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(getInitialMode);
  const [accent, setAccentState] = useState(getInitialAccent);
  const [systemIsDark, setSystemIsDark] = useState(() => getSystemTheme() === "dark");

  // Listen to OS dark-mode shifts when mode is "system".
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => setSystemIsDark(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const resolvedTheme = mode === "system" ? (systemIsDark ? "dark" : "light") : mode;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    try {
      localStorage.setItem(THEME_KEY, mode);
    } catch {
      // localStorage unavailable
    }
  }, [mode, resolvedTheme]);

  useLayoutEffect(() => {
    applyAccent(accent);
    try {
      if (accent === DEFAULT_ACCENT) localStorage.removeItem(ACCENT_KEY);
      else localStorage.setItem(ACCENT_KEY, accent);
    } catch {
      // localStorage unavailable
    }
  }, [accent]);

  const setTheme = useCallback((next) => {
    if (next === "system" || next === "dark" || next === "light") {
      setModeState(next);
    } else {
      setModeState("light");
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setModeState((current) => {
      const active = current === "system" ? (systemIsDark ? "dark" : "light") : current;
      return active === "dark" ? "light" : "dark";
    });
  }, [systemIsDark]);

  const setAccent = useCallback((next) => {
    setAccentState(isAccent(next) ? next : DEFAULT_ACCENT);
  }, []);

  // Allows syncing user preferences from the database when an account loads.
  const syncPreferences = useCallback((themePref) => {
    if (!themePref) return;
    try {
      const data = typeof themePref === "string" ? JSON.parse(themePref) : themePref;
      if (data?.mode && (data.mode === "light" || data.mode === "dark" || data.mode === "system")) {
        setModeState(data.mode);
      }
      if (data?.accent && isAccent(data.accent)) {
        setAccentState(data.accent);
      }
    } catch {
      // Ignore invalid themePreference JSON
    }
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme: resolvedTheme,
        mode,
        setMode: setTheme,
        setTheme,
        toggleTheme,
        accent,
        setAccent,
        syncPreferences,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: "light",
      mode: "system",
      setMode: () => {},
      setTheme: () => {},
      toggleTheme: () => {},
      accent: DEFAULT_ACCENT,
      setAccent: () => {},
      syncPreferences: () => {},
    };
  }
  return ctx;
}
