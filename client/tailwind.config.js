import plugin from "tailwindcss/plugin";
import containerQueries from "@tailwindcss/container-queries";
import { STEPS, basePalette } from "./src/lib/palette.js";

// A color scale read from CSS variables holding space-separated RGB
// channels, which keeps Tailwind's opacity modifiers (bg-brand-500/10) working.
const scale = (name) => Object.fromEntries(STEPS.map((s) => [s, `rgb(var(--${name}-${s}) / <alpha-value>)`]));

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Both scales are CSS variables so the theme color can change at
        // runtime (see src/lib/palette.js for what each step is for, and
        // ThemeContext for the switcher). Defaults are set on :root below.
        ink: scale("ink"),
        brand: scale("brand"),
        accent: {
          50: "#FFFBEB",
          100: "#FEF3C7",
          200: "#FDE68A",
          300: "#FCD34D",
          400: "#FBBF24",
          500: "#F59E0B",
          600: "#D97706",
          700: "#B45309",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(10,15,13,0.06), 0 1px 3px rgba(10,15,13,0.08)",
        panel: "0 4px 6px -1px rgba(10,15,13,0.1), 0 2px 4px -2px rgba(10,15,13,0.06)",
        // Glass surfaces sit on a dark ground, so their depth comes from a
        // wide ambient shadow plus a hairline top highlight rather than a
        // tight drop shadow.
        glass: "0 8px 32px -8px rgba(10,15,13,0.45), inset 0 1px 0 0 rgba(255,255,255,0.06)",
        "glass-lg": "0 24px 64px -16px rgba(10,15,13,0.55), inset 0 1px 0 0 rgba(255,255,255,0.08)",
        glow: "0 8px 24px -6px rgb(var(--brand-500) / 0.5), inset 0 1px 0 0 rgb(var(--brand-300) / 0.25)",
        "glow-sm": "0 4px 12px -3px rgb(var(--brand-500) / 0.45), inset 0 1px 0 0 rgb(var(--brand-300) / 0.2)",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
        "3xl": "1.5rem",
      },
      keyframes: {
        "toast-in": {
          "0%": { opacity: "0", transform: "translateX(16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "toast-shrink": {
          "0%": { width: "100%" },
          "100%": { width: "0%" },
        },
        // A newly created folder/card condensing into existence, rather than
        // popping in — scale and blur resolve together so it reads as the
        // glass surface forming.
        materialize: {
          "0%": { opacity: "0", transform: "scale(0.92)", filter: "blur(6px)" },
          "60%": { opacity: "1" },
          "100%": { opacity: "1", transform: "scale(1)", filter: "blur(0)" },
        },
        // Marks the folder a new item just landed inside of.
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgb(var(--brand-300) / 0)" },
          "35%": { boxShadow: "0 0 0 4px rgb(var(--brand-300) / 0.35), 0 8px 24px -6px rgb(var(--brand-500) / 0.5)" },
        },
        // Same signal for a non-rectangular element — drop-shadow follows the
        // drawn silhouette, where box-shadow would halo the bounding box.
        "glow-pulse-drop": {
          "0%, 100%": { filter: "drop-shadow(0 0 0 rgb(var(--brand-300) / 0))" },
          "35%": { filter: "drop-shadow(0 0 9px rgb(var(--brand-300) / 0.85))" },
        },
        "slide-fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        // A dashboard skyline floor settling onto the one below it.
        rise: {
          "0%": { opacity: "0", transform: "scaleY(0)" },
          "100%": { opacity: "1", transform: "scaleY(1)" },
        },
      },
      animation: {
        "toast-in": "toast-in 0.2s ease-out",
        // Duration must match TOAST_SECONDS in MentionToasts.jsx — this bar
        // is the visual half of the countdown, the numeral is the other half.
        "toast-shrink": "toast-shrink 6s linear forwards",
        // Durations are mirrored by the timers that clear the trigger state in
        // WorkspaceStorage.jsx — keep them in sync.
        materialize: "materialize 0.42s cubic-bezier(0.22, 1, 0.36, 1)",
        "glow-pulse": "glow-pulse 1.1s ease-in-out 2",
        "glow-pulse-drop": "glow-pulse-drop 1.1s ease-in-out 2",
        "slide-fade-in": "slide-fade-in 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
        "fade-in": "fade-in 0.25s ease-out",
        // `both` holds the collapsed first frame through the stagger delay.
        rise: "rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [
    // @container / @lg: variants — dashboard panels size themselves to their
    // own width, since users resize them.
    containerQueries,
    // The emerald defaults. ThemeContext overrides these inline on <html>
    // when the user picks another theme color.
    plugin(({ addBase }) => {
      addBase({
        ":root": Object.fromEntries(Object.entries(basePalette()).map(([k, v]) => [`--${k}`, v])),
      });
    }),
  ],
};
