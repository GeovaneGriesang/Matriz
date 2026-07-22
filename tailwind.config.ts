import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Paleta oficial da marca Instituto Federal (Manual de Aplicação da
        // Marca IF, Setec/MEC nº 31/2015 — usada pelos 38 Institutos Federais).
        "if-green": "#2f9e41",
        "if-red": "#cd191e",
        "if-black": "#000000",
      },
      fontFamily: {
        sans: ["var(--font-open-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
