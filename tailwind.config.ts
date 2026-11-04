import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F7F6F3",
        ink: "#221F1C",
        pine: { DEFAULT: "#1F4D3A", dark: "#163A2C", soft: "#EAF1ED" },
        sand: "#E9E4DB",
        line: "#E5E1D8",
        amber: "#9A6B15",
        danger: "#8C2F1B"
      },
      fontFamily: {
        display: ["Iowan Old Style", "Palatino Linotype", "Georgia", "serif"],
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Helvetica Neue", "Arial", "sans-serif"]
      }
    }
  },
  plugins: []
};
export default config;
