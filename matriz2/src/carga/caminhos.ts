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

/**
 * A exportação oficial da MDO para 2026 saiu com a matrícula por câmpus zerada (ver
 * `carregarProposta.ts`), e o IFTM nunca corrigiu. Para 2026, e só para 2026, existe
 * uma fonte alternativa: um arquivo da mesma proposta, obtido por outro canal (não a
 * exportação oficial do usuário), com matrícula e indicadores de verdade — ainda que
 * sem o valor final por matrícula (ver ressalva gravada em `carregarProposta.ts`).
 * O nome do arquivo carrega "2025" porque é o ano em que a proposta foi GERADA
 * ("Gerado em 06/11/2025"), não o ciclo que ela propõe.
 */
const FONTE_ALTERNATIVA_2026 = path.join(RAIZ_DADOS, "Outras fontes", "2026", "Matriz Distribuição Orçamentária 2025.xlsx");

/** 5ª fase: a proposta compilada, com todos os blocos por câmpus e instituição. */
export function planilhaProposta(ano: number): string {
  if (ano === 2026 && fs.existsSync(FONTE_ALTERNATIVA_2026)) return FONTE_ALTERNATIVA_2026;
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

/**
 * 2ª fase, Conferência da Extração da PNP, por unidade. Só existe para o IFSul, e o
 * nome do arquivo carrega o ano-base da PNP, que não é o ciclo: procura o do ciclo
 * (N-2, N-1 e N) e devolve o primeiro que existir.
 */
export function conferenciaExtracao(ciclo: number, sigla: string): string | null {
  const pasta = path.join(
    EXPORTADOS,
    "01 - Matriz orçamentária",
    "2a fase - Conferência Extração PNP",
    "01 - Por unidade",
    sigla,
    String(ciclo),
  );
  for (const base of [ciclo - 2, ciclo - 1, ciclo]) {
    const c = path.join(pasta, `conferencia_extracao_pnp_por_unidade_${base}.xlsx`);
    if (fs.existsSync(c)) return c;
  }
  return null;
}

/**
 * 2ª fase, Conferência da Extração da PNP, por ALUNO (microdado individual, um
 * registro por matrícula). Só existe para o IFSul. O nome do arquivo é INSTÁVEL: a
 * pasta de 2027 chegou, por engano da própria MDO, com um arquivo chamado "Matriz
 * Distribuição Orçamentária 2027.xlsx" (nome de outro relatório, conteúdo certo).
 * Por isso a busca é pelo único .xlsx que existir na pasta, não por um nome fixo.
 */
export function conferenciaExtracaoAluno(ciclo: number, sigla: string): string | null {
  const pasta = path.join(
    EXPORTADOS,
    "01 - Matriz orçamentária",
    "2a fase - Conferência Extração PNP",
    "03 - Por aluno",
    sigla,
    String(ciclo),
  );
  if (!fs.existsSync(pasta)) return null;
  const arquivo = fs.readdirSync(pasta).find((f) => f.toLowerCase().endsWith(".xlsx"));
  return arquivo ? path.join(pasta, arquivo) : null;
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
