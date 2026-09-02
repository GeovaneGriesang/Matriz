import path from "node:path";
import fs from "node:fs";

/**
 * Onde vivem as exportações oficiais. Ficam FORA do repositório de propósito: são
 * arquivos grandes, atualizados a cada rodada de homologação da MDO, e alguns
 * trazem dados de instituições que não são o IFSul. O repositório guarda o código
 * que os lê, nunca uma cópia deles.
 *
 * `MATRIZ2_DADOS` permite apontar para outro lugar (outra máquina, um servidor)
 * sem editar código.
 */
export const RAIZ_DADOS =
  process.env.MATRIZ2_DADOS ??
  path.join(
    "C:",
    "Users",
    "USER",
    "OneDrive",
    "Documentos",
    "IFSul",
    "_Matriz orçamentária - CONIF",
  );

const EXPORTADOS = path.join(RAIZ_DADOS, "mdo.iftm.edu.br", "Exportados");

/** 5ª fase: a proposta compilada, com todos os blocos por câmpus e instituição. */
export function planilhaProposta(ano: number): string {
  return path.join(
    EXPORTADOS,
    "01 - Matriz orçamentária",
    "5a fase - Matriz de Distribuição Orçamentária",
    "01 - Completo proposta",
    String(ano),
    `Matriz Distribuição Orçamentária ${ano}.xlsx`,
  );
}

/** 6ª fase: a participação de cada ciclo de curso. Existe só para 2027 até agora. */
export function planilhaParticipacao(ano: number): string {
  return path.join(
    EXPORTADOS,
    "01 - Matriz orçamentária",
    "6a fase - Participação Orçamentária",
    String(ano),
    `participacao_orcamentaria_${ano}.xlsx`,
  );
}

/**
 * Relatórios da pasta "03 - Indicadores". São interanuais: o mesmo arquivo traz 2026
 * e 2027, e as duas pastas de ano contêm cópias byte a byte idênticas. O parâmetro de
 * ano serve só para escolher de qual pasta ler.
 */
export function relatorioIndicadores(pastaAno: number, arquivo: string): string {
  return path.join(EXPORTADOS, "03 - Indicadores", String(pastaAno), arquivo);
}

export function existe(caminho: string): boolean {
  return fs.existsSync(caminho);
}

/** Falha cedo e com mensagem útil: o caminho errado é o erro mais provável aqui. */
export function exigirArquivo(caminho: string, oQueEra: string): string {
  if (!fs.existsSync(caminho)) {
    throw new Error(
      `Não encontrei ${oQueEra}.\n  Esperava em: ${caminho}\n` +
        `  Se os arquivos estão em outro lugar, defina a variável MATRIZ2_DADOS apontando para a pasta ` +
        `"_Matriz orçamentária - CONIF".`,
    );
  }
  return caminho;
}
