import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        cricket: {
          grass: "#15803d",
          pitch: "#d97706",
          boundary: "#dc2626",
          dark: "#0b1315",
          card: "#121e22",
          border: "#1f3037",
          accent: "#22c55e",
          glow: "#4ade80",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
