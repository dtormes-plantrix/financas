import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        tinta: "#1c2321",
        papel: "#f6f4ef",
        verde: { DEFAULT: "#1f7a4d", claro: "#e3f1e8" },
        amarelo: { DEFAULT: "#a86b00", claro: "#fbf0d9" },
        vermelho: { DEFAULT: "#b3261e", claro: "#f9e1df" },
      },
      fontFamily: { sans: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"] },
    },
  },
  plugins: [],
} satisfies Config;
