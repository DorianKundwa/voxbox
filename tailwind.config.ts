// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      colors: {
        void: {
          900: "#060608",
          800: "#0a0a0f",
          700: "#0f0f1a",
          600: "#141422",
          500: "#1a1a2e",
        },
        violet: {
          50:  "#f5f0ff",
          100: "#ede0ff",
          200: "#d8bdff",
          300: "#be93ff",
          400: "#a060ff",
          500: "#7c3aed",
          600: "#6020d0",
          700: "#4b19a8",
          800: "#3d1685",
          900: "#2e1060",
        },
        cyan: {
          50:  "#ecfeff",
          100: "#cffafe",
          200: "#a5f3fc",
          300: "#67e8f9",
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
          700: "#0e7490",
          800: "#155e75",
          900: "#164e63",
        },
        neon: {
          green:  "#39ff14",
          pink:   "#ff1493",
          orange: "#ff6600",
          yellow: "#ffdd00",
        }
      },
      backgroundImage: {
        "void-gradient": "radial-gradient(ellipse at 20% 0%, rgba(124,58,237,0.12) 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, rgba(6,182,212,0.08) 0%, transparent 60%)",
      },
      animation: {
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "scan": "scan 3s linear infinite",
        "float": "float 6s ease-in-out infinite",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-up": "slide-up 0.4s ease-out",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        "scan": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100vw)" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
      },
      boxShadow: {
        "glow-violet": "0 0 20px rgba(124,58,237,0.4), 0 0 60px rgba(124,58,237,0.1)",
        "glow-cyan": "0 0 20px rgba(6,182,212,0.4), 0 0 60px rgba(6,182,212,0.1)",
        "glow-sm": "0 0 8px rgba(124,58,237,0.3)",
        "module": "0 4px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};

export default config;
