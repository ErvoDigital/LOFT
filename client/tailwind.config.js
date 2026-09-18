/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Neutral scale, tinted toward the brand green. Anchored on the LOFT
        // palette: 950 is the page background, 900 the card surface, 400 the
        // muted text and 50 the heading text on dark.
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
        // Brand — 300 is the mint accent (CTAs, icons, glow; keep it off large
        // fills), 500 the mid teal and 800 the deep emerald that give depth.
        // Fills from 300–500 take dark text (ink-950); 600–700 are the
        // light-mode text shades.
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
        glow: "0 8px 24px -6px rgba(94,234,212,0.4)",
        "glow-sm": "0 4px 12px -3px rgba(94,234,212,0.35)",
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
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(94,234,212,0)" },
          "35%": { boxShadow: "0 0 0 4px rgba(94,234,212,0.35), 0 8px 24px -6px rgba(31,155,125,0.5)" },
        },
        // Same signal for a non-rectangular element — drop-shadow follows the
        // drawn silhouette, where box-shadow would halo the bounding box.
        "glow-pulse-drop": {
          "0%, 100%": { filter: "drop-shadow(0 0 0 rgba(94,234,212,0))" },
          "35%": { filter: "drop-shadow(0 0 9px rgba(94,234,212,0.85))" },
        },
        "slide-fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
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
      },
    },
  },
  plugins: [],
};
