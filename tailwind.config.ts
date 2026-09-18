import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // ink/paper/line/surface are backed by CSS vars (see globals.css)
        // flipped under .dark, so every existing text-ink/bg-paper/
        // border-line/bg-surface usage across the app repaints for free —
        // no per-page changes needed.
        ink: "rgb(var(--ink) / <alpha-value>)",
        // teal is the site's primary accent — in dark mode it becomes cyan
        // (see the html.dark .theme-scope override in globals.css), so every
        // text-teal/border-teal/bg-teal usage repaints too.
        teal: {
          DEFAULT: "rgb(var(--teal) / <alpha-value>)",
          light: "rgb(var(--teal-light) / <alpha-value>)",
          deep: "rgb(var(--teal-deep) / <alpha-value>)",
        },
        paper: "rgb(var(--paper) / <alpha-value>)",
        volt: "#B6FF3D",
        line: "rgb(var(--line) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        gold: "#D4AF37",
        silver: "#C0C0C0",
        bronze: "#CD7F32",
        // Dark mode accent set.
        cyan: "#29D9EA",
        neon: "#B6FF3D",
        royal: "#3D5AFE",
      },
      fontFamily: {
        sans: ["var(--font-space-grotesk)", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
      },
      clipPath: {
        notch: "polygon(0 0, 100% 0, 100% 85%, 92% 100%, 0 100%)",
      },
    },
  },
  plugins: [],
};
export default config;
