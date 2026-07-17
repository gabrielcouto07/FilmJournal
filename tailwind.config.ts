import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cinema: { 950: "#0a0a0a", 900: "#111111", 800: "#1a1a1a" },
        gold: { DEFAULT: "#f5c518", soft: "#ffd60a", deep: "#c99a0f" },
      },
      maxWidth: { cinema: "1480px" },
      transitionTimingFunction: { cinema: "cubic-bezier(.2,.8,.2,1)" },
    },
  },
  plugins: [],
};

export default config;
