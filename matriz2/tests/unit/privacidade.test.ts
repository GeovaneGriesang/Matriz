import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `ConferenciaExtracaoAluno` guarda um registro por matrícula de aluno (câmpus +
 * curso + datas + faixa de renda), decisão do usuário em 2026-09-03 de carregar só
 * para auditoria interna, nunca expor numa tela ou API pública.
 *
 * Um `grep` manual confirmou isso na hora da carga, mas manual não sobrevive à
 * próxima mudança. Este teste escaneia toda rota pública do Next (`src/app`) e
 * varre por qualquer menção ao model ou ao carregador; se alguém um dia importar
 * `ConferenciaExtracaoAluno` numa página, o teste quebra antes do deploy.
 */

const RAIZ = path.resolve(__dirname, "..", "..");
const PASTAS_PUBLICAS = ["src/app", "src/components"];
const TERMOS_PROIBIDOS = ["ConferenciaExtracaoAluno", "carregarConferenciaAluno", "conferenciaExtracaoAluno"];

function listarArquivos(pasta: string): string[] {
  if (!fs.existsSync(pasta)) return [];
  const resultado: string[] = [];
  for (const entrada of fs.readdirSync(pasta, { withFileTypes: true })) {
    const caminho = path.join(pasta, entrada.name);
    if (entrada.isDirectory()) resultado.push(...listarArquivos(caminho));
    else if (/\.(ts|tsx)$/.test(entrada.name)) resultado.push(caminho);
  }
  return resultado;
}

describe("privacidade: dado por aluno nunca chega a rota pública", () => {
  it("nenhum arquivo em src/app ou src/components menciona o model ou o carregador de dado por aluno", () => {
    const ofensores: string[] = [];
    for (const pasta of PASTAS_PUBLICAS) {
      for (const arquivo of listarArquivos(path.join(RAIZ, pasta))) {
        const conteudo = fs.readFileSync(arquivo, "utf-8");
        for (const termo of TERMOS_PROIBIDOS) {
          if (conteudo.includes(termo)) {
            ofensores.push(`${path.relative(RAIZ, arquivo)} menciona "${termo}"`);
          }
        }
      }
    }
    expect(ofensores).toEqual([]);
  });

  it("o próprio conjunto de pastas escaneadas não está vazio (o teste não estaria testando nada)", () => {
    const totalArquivos = PASTAS_PUBLICAS.reduce((soma, p) => soma + listarArquivos(path.join(RAIZ, p)).length, 0);
    expect(totalArquivos).toBeGreaterThan(0);
  });
});
