"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "matriz-theme";

type Theme = "light" | "dark";

function aplicarTema(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const atual = document.documentElement.classList.contains("dark") ? "dark" : "light";
    setTheme(atual);
  }, []);

  function alternar() {
    const proximo: Theme = theme === "dark" ? "light" : "dark";
    setTheme(proximo);
    aplicarTema(proximo);
    localStorage.setItem(STORAGE_KEY, proximo);
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
      title={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
      className="ml-auto flex items-center gap-1.5 rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
    >
      {theme === "dark" ? "☀️ Claro" : "🌙 Escuro"}
    </button>
  );
}
