import type { Config } from "tailwindcss";

// Tailwind v4 — uses @import "tailwindcss" in CSS, config is optional
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;