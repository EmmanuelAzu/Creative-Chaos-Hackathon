import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#12143D",
        teal: {
          DEFAULT: "#12736F",
          light: "#4FBDB6",
          deep: "#0A4A47",
        },
        paper: "#F5F7F0",
        volt: "#B6FF3D",
        line: "#D8DCEC",
        gold: "#D4AF37",
        silver: "#C0C0C0",
        bronze: "#CD7F32",
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
