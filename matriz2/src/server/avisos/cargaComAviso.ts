import { prisma } from "@/server/db/prisma";
import { avisarCarga } from "./avisos";

/**
 * Roda um script de carga e, se ele terminar bem, registra o aviso do robô azul com o resumo que o próprio script imprimiu
 * (as últimas 40 linhas). Uma carga que falha não gera aviso: o erro aparece no terminal de quem rodou.
 */
export async function executarCargaComAviso(titulo: string, link: string | undefined, principal: () => Promise<void>): Promise<void> {
  const linhas: string[] = [];
  const original = console.log;
  console.log = (...partes: unknown[]) => {
    linhas.push(partes.map((p) => (typeof p === "string" ? p : JSON.stringify(p))).join(" "));
    original(...partes);
  };
  try {
    await principal();
  } finally {
    console.log = original;
  }
  try {
    await avisarCarga(titulo, linhas.slice(-40), link);
  } finally {
    await prisma.$disconnect();
  }
}
