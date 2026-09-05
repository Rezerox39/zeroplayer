/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        black: { pure: "#000000" },
        accent: {
          green: "#00ff88",
          cyan: "#00e5ff",
          purple: "#b366ff",
        },
        surface: {
          0: "#000000",
          1: "#0a0a0a",
          2: "#111111",
          3: "#1a1a1a",
          4: "#222222",
        },
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "'Fira Code'", "'Inconsolata'", "monospace"],
        sans: ["'Inter'", "'Helvetica Neue'", "sans-serif"],
      },
    },
  },
  plugins: [],
};
