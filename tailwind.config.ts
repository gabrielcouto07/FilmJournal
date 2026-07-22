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
        // amber (and the gold alias) are driven by the user's accent color:
        // each shade resolves against the --accent-<level> ramp set at runtime
        // by SettingsProvider (defaults live in globals.css :root). The
        // `<alpha-value>` placeholder keeps Tailwind's /opacity modifiers working.
        amber: {
          50: "rgb(var(--accent-50) / <alpha-value>)",
          100: "rgb(var(--accent-100) / <alpha-value>)",
          200: "rgb(var(--accent-200) / <alpha-value>)",
          300: "rgb(var(--accent-300) / <alpha-value>)",
          400: "rgb(var(--accent-400) / <alpha-value>)",
          500: "rgb(var(--accent-500) / <alpha-value>)",
          600: "rgb(var(--accent-600) / <alpha-value>)",
          700: "rgb(var(--accent-700) / <alpha-value>)",
          800: "rgb(var(--accent-800) / <alpha-value>)",
          900: "rgb(var(--accent-900) / <alpha-value>)",
        },
        gold: {
          DEFAULT: "rgb(var(--accent-300) / <alpha-value>)",
          soft: "rgb(var(--accent-200) / <alpha-value>)",
          deep: "rgb(var(--accent-500) / <alpha-value>)",
        },
      },
      maxWidth: { cinema: "1480px" },
      transitionTimingFunction: { cinema: "cubic-bezier(.2,.8,.2,1)" },
    },
  },
  plugins: [],
};

export default config;
