import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f3f8f7",
          100: "#e6f0ef",
          200: "#c8d6d5",
          300: "#a3b5b4",
          400: "#74908f",
          500: "#3a4f58",
          600: "#26373f",
          700: "#1a272e",
          800: "#121c22",
          850: "#0e151a",
          900: "#0a0f12",
          950: "#06090b",
        },
        mint: "#7CF6C8",
        cyanx: "#38E1FF",
        ai: "#C084FC",
        human: "#FBBF24",
        up: "#34D399",
        down: "#FB7185",
        muted: "#8AA0A0",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(124,246,200,0.18), 0 0 40px -8px rgba(124,246,200,0.25)",
        card: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 24px 48px -24px rgba(0,0,0,0.8)",
      },
      keyframes: {
        pulseglow: {
          "0%,100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
        rise: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        pulseglow: "pulseglow 2.4s ease-in-out infinite",
        rise: "rise 0.4s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
