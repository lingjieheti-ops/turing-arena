import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Blue-black "night city" dark scale.
        ink: {
          50: "#eef3fc",
          100: "#d8e2f4",
          200: "#aebcd8",
          300: "#8595b8",
          400: "#5e7099",
          500: "#3e4f7e",
          600: "#2a3760",
          700: "#1b2547",
          800: "#10172e",
          850: "#0b1024",
          900: "#080c1c",
          950: "#05060f",
        },
        // Dual-neon: electric cyan (primary) + hot magenta (accent).
        mint: "#3DF2FF", // primary neon (kept the token name; now cyan, not green)
        cyanx: "#38E1FF",
        hot: "#FF36C6", // magenta
        ai: "#C887FF", // electric violet
        human: "#FFC53D", // amber
        up: "#2BFF9A", // neon green
        down: "#FF456E", // neon red
        muted: "#6E80A6",
      },
      fontFamily: {
        sans: ["var(--font-display)", "ui-sans-serif", "system-ui", "Segoe UI", "sans-serif"],
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(61,242,255,0.30), 0 0 30px -6px rgba(61,242,255,0.55)",
        glowhot: "0 0 0 1px rgba(255,54,198,0.30), 0 0 30px -6px rgba(255,54,198,0.5)",
        card: "0 0 0 1px rgba(61,242,255,0.05) inset, 0 20px 60px -30px rgba(0,0,0,0.95)",
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
        flicker: {
          "0%,18%,22%,25%,53%,57%,100%": { opacity: "1" },
          "20%,24%,55%": { opacity: "0.45" },
        },
        scan: {
          from: { transform: "translateY(-100%)" },
          to: { transform: "translateY(100vh)" },
        },
        ticker: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
      },
      animation: {
        pulseglow: "pulseglow 2.4s ease-in-out infinite",
        rise: "rise 0.4s ease-out both",
        flicker: "flicker 4s linear infinite",
        scan: "scan 7s linear infinite",
        ticker: "ticker 32s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
