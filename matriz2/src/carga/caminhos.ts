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
 * A MDO reexporta a cada rodada de homologação, e quem organiza os arquivos costuma
 * guardar a versão nova ao lado da antiga, prefixada com a data da exportação (ex.:
 * "20262909_conferencia_...xlsx", e também "20260929_..." na 6ª fase: a ordem dia e mês
 * não é constante). Por isso o nome de arquivo nunca é fixo: procura o nome-base com ou
 * sem um prefixo de 8 dígitos e fica com o de modificação mais recente.
 */
/**
 * Como `path.join`, mas casa cada trecho com o nome real da pasta sem diferenciar
 * maiúsculas de minúsculas. No Windows isso é automático; no Linux da VM, a sigla
 * "IFSUL" não achava a pasta "IFSul" e a carga pulava a 2ª fase em silêncio.
 */
function caixaCerta(...partes: string[]): string {
  let atual = partes[0]!;
  for (const parte of partes.slice(1)) {
    const direto = path.join(atual, parte);
    if (fs.existsSync(direto) || !fs.existsSync(atual)) {
      atual = direto;
      continue;
    }
    const achada = fs.readdirSync(atual).find((nome) => nome.toLowerCase() === parte.toLowerCase());
    atual = path.join(atual, achada ?? parte);
  }
  return atual;
}

const PREFIXO_DE_DATA = /^[0-9]{8}_/;

/** Todos os arquivos da pasta com esse nome (com ou sem o prefixo de data), do mais novo para o mais antigo. */
function candidatosPorData(pasta: string, nomeBase: string): string[] {
  if (!fs.existsSync(pasta)) return [];
  const alvo = nomeBase.toLowerCase();
  return fs
    .readdirSync(pasta)
    .filter((nome) => {
      const n = nome.toLowerCase();
      return n === alvo || (n.length === alvo.length + 9 && PREFIXO_DE_DATA.test(n) && n.endsWith(alvo));
    })
    .map((nome) => path.join(pasta, nome))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
}

function maisRecente(pasta: string, nomeBase: string): string | null {
  if (!fs.existsSync(pasta)) return null;
  const alvo = nomeBase.toLowerCase();
  let melhor: { caminho: string; quando: number } | null = null;
  for (const nome of fs.readdirSync(pasta)) {
    const n = nome.toLowerCase();
    if (n !== alvo && !(n.length === alvo.length + 9 && PREFIXO_DE_DATA.test(n) && n.endsWith(alvo))) continue;
    const caminho = path.join(pasta, nome);
    const quando = fs.statSync(caminho).mtimeMs;
    if (!melhor || quando > melhor.quando) melhor = { caminho, quando };
  }
  return melhor?.caminho ?? null;
}

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

/**
 * Sempre a exportação oficial, nunca a fonte alternativa de 2026: existe à parte
 * porque algumas abas (ex.: EXPANSÃO, com a lista de câmpus novos no Piso Mínimo)
 * só existem no arquivo oficial, mesmo quando ele tem a matrícula por câmpus
 * zerada e por isso `planilhaProposta` prefere a alternativa para o resto da carga.
 */
export function planilhaPropostaOficial(ano: number): string {
  const pasta = caixaCerta(
    EXPORTADOS,
    "01 - Matriz orçamentária",
    "5a fase - Matriz de Distribuição Orçamentária",
    "01 - Completo proposta",
    String(ano),
  );
  const nome = `Matriz Distribuição Orçamentária ${ano}.xlsx`;
  return maisRecente(pasta, nome) ?? path.join(pasta, nome);
}

/** 5ª fase: a proposta compilada, com todos os blocos por câmpus e instituição. */
export function planilhaProposta(ano: number): string {
  // Desde a reexportação de 2026-09-29 a exportação oficial de 2026 traz a matrícula por
  // câmpus preenchida, então a fonte alternativa só serve quando não há arquivo oficial.
  const oficial = planilhaPropostaOficial(ano);
  if (ano === 2026 && !fs.existsSync(oficial) && fs.existsSync(FONTE_ALTERNATIVA_2026)) return FONTE_ALTERNATIVA_2026;
  return oficial;
}

/**
 * Os arquivos que podem ser a 6ª fase da rede de um ciclo, do mais novo para o mais antigo. A MDO tem outros relatórios com nome
 * parecido (a "Participação" resumida por curso, sem código de ciclo): a carga confere o layout de cada um e usa o primeiro que serve.
 */
export function candidatosParticipacao(ano: number): string[] {
  const pasta = caixaCerta(EXPORTADOS, "01 - Matriz orçamentária", "6a fase - Participação Orçamentária", String(ano));
  return candidatosPorData(pasta, `participacao_orcamentaria_${ano}.xlsx`);
}

/** 6ª fase: a participação de cada ciclo de curso. Existe só para 2027 até agora. */
export function planilhaParticipacao(ano: number): string {
  const pasta = caixaCerta(EXPORTADOS, "01 - Matriz orçamentária", "6a fase - Participação Orçamentária", String(ano));
  const nome = `participacao_orcamentaria_${ano}.xlsx`;
  return maisRecente(pasta, nome) ?? path.join(pasta, nome);
}

/**
 * 6ª fase de UMA instituição (ex.: "participacao_orcamentaria_2027_IFSul.xlsx"). Este
 * formato é outro: chega como planilha com fórmulas (sem os valores calculados) e traz
 * a aba "Parâmetros" com o orçamento e as matrículas totais usados no cálculo.
 */
export function planilhaParticipacaoInstituicao(ano: number, sigla: string): string | null {
  const sufixo = `_${sigla}.xlsx`.toLowerCase();
  const prefixo = `participacao_orcamentaria_${ano}`;
  let melhor: { caminho: string; quando: number } | null = null;
  // O arquivo da 6ª fase de uma instituição já chegou salvo na pasta da 5ª fase ("Completo proposta") em 2026: procura nas duas.
  for (const pasta of pastasDeParticipacao(ano)) {
    if (!fs.existsSync(pasta)) continue;
    for (const nome of fs.readdirSync(pasta)) {
      const n = nome.toLowerCase().replace(PREFIXO_DE_DATA, "");
      if (!n.startsWith(prefixo) || !n.endsWith(sufixo)) continue;
      const caminho = path.join(pasta, nome);
      const quando = fs.statSync(caminho).mtimeMs;
      if (!melhor || quando > melhor.quando) melhor = { caminho, quando };
    }
  }
  return melhor?.caminho ?? null;
}

/** As pastas em que os relatórios de participação de um ciclo já apareceram: a da 6ª fase e a da 5ª fase ("Completo proposta"). */
function pastasDeParticipacao(ano: number): string[] {
  return [
    caixaCerta(EXPORTADOS, "01 - Matriz orçamentária", "6a fase - Participação Orçamentária", String(ano)),
    caixaCerta(EXPORTADOS, "01 - Matriz orçamentária", "5a fase - Matriz de Distribuição Orçamentária", "01 - Completo proposta", String(ano)),
  ];
}

/**
 * Candidatos a relatório RESUMIDO da rede de um ciclo (por curso, sem código de ciclo), do mais novo para o mais antigo. O nome é o mesmo
 * da 6ª fase por ciclo, então quem chama confere o layout.
 */
export function candidatosResumoDaRede(ano: number): string[] {
  return pastasDeParticipacao(ano)
    .flatMap((p) => candidatosPorData(p, `participacao_orcamentaria_${ano}.xlsx`))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
}

/**
 * Relatórios da pasta "03 - Indicadores". Até 2026-08-31 eram interanuais: o mesmo
 * arquivo trazia 2026 e 2027, e as duas pastas de ano continham cópias idênticas. A
 * exportação de 2026-09-29 passou a gerar um arquivo por ano (só o ano da pasta).
 */
export function relatorioIndicadores(pastaAno: number, arquivo: string): string {
  // Desde 2026-09-29 os relatórios ficam numa subpasta ("1 - Visão geral"); antes ficavam
  // direto na pasta do ano. Procura nas duas, e a versão mais recente vence.
  const base = path.join(EXPORTADOS, "03 - Indicadores", String(pastaAno));
  for (const sub of ["1 - Visão geral", ""]) {
    const achado = maisRecente(path.join(base, sub), arquivo);
    if (achado) return achado;
  }
  return path.join(base, arquivo);
}

/**
 * 2ª fase, Conferência da Extração da PNP, por unidade. Só existe para o IFSul, e o
 * nome do arquivo carrega o ano-base da PNP, que não é o ciclo: procura o do ciclo
 * (N-2, N-1 e N) e devolve o primeiro que existir.
 */
export function conferenciaExtracao(ciclo: number, sigla: string): string | null {
  const pasta = caixaCerta(
    EXPORTADOS,
    "01 - Matriz orçamentária",
    "2a fase - Conferência Extração PNP",
    "01 - Por unidade",
    sigla,
    String(ciclo),
  );
  for (const base of [ciclo - 2, ciclo - 1, ciclo]) {
    const c = maisRecente(pasta, `conferencia_extracao_pnp_por_unidade_${base}.xlsx`);
    if (c) return c;
  }
  return null;
}

/**
 * 2ª fase, Conferência da Extração da PNP, POR CICLO DE CURSO: uma aba por câmpus, com
 * a matrícula de cada ciclo aberta por situação e por faixa de renda, mais uma aba
 * INDICADORES da rede. Só existe para o IFSul. Mesma regra de nome do arquivo por
 * unidade: o ano no nome é o da PNP, não o do ciclo orçamentário.
 */
export function conferenciaExtracaoCiclos(ciclo: number, sigla: string): string | null {
  const pasta = caixaCerta(
    EXPORTADOS,
    "01 - Matriz orçamentária",
    "2a fase - Conferência Extração PNP",
    "02 - Por ciclo",
    sigla,
    String(ciclo),
  );
  for (const base of [ciclo - 2, ciclo - 1, ciclo]) {
    const c = maisRecente(pasta, `conferencia_extracao_pnp_por_ciclos_${base}.xlsx`);
    if (c) return c;
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
  const pasta = caixaCerta(
    EXPORTADOS,
    "01 - Matriz orçamentária",
    "2a fase - Conferência Extração PNP",
    "03 - Por aluno",
    sigla,
    String(ciclo),
  );
  if (!fs.existsSync(pasta)) return null;
  const candidatos = fs
    .readdirSync(pasta)
    .filter((f) => f.toLowerCase().endsWith(".xlsx"))
    .map((f) => ({ caminho: path.join(pasta, f), quando: fs.statSync(path.join(pasta, f)).mtimeMs }))
    .sort((a, b) => b.quando - a.quando);
  return candidatos[0]?.caminho ?? null;
}

/**
 * Painel "Dados de Ensino" da PNP baixado à mão: `CSV da PNP/Manual/<ciclo>/Dados do Ensino`.
 * O ano da pasta é o ciclo orçamentário (2027), não o ano-base: cada CSV traz 2017 a 2025.
 */
export function pastaPnpManual(ciclo: number, painel = "Dados do Ensino"): string {
  return caixaCerta(RAIZ_DADOS, "CSV da PNP", "Manual", String(ciclo), painel);
}

/** Microdados e Extrator da PNP: `CSV da PNP/Manual/<ciclo>/Produtos de dados/<produto>`. */
export function pastaPnpProduto(ciclo: number, produto: "Microdados" | "Extrator"): string {
  return caixaCerta(RAIZ_DADOS, "CSV da PNP", "Manual", String(ciclo), "Produtos de dados", produto);
}

/** Painel "Dados Orçamentários" da PNP baixado à mão: `CSV da PNP/Manual/<ciclo>/Dados Orçamentários`. */
export function pastaPnpOrcamento(ciclo: number): string {
  return caixaCerta(RAIZ_DADOS, "CSV da PNP", "Manual", String(ciclo), "Dados Orçamentários");
}

export function existe(caminho: string): boolean {
  return fs.existsSync(caminho);
}

/**
 * Pasta-base de cada fase, para achar de volta o arquivo original de uma
 * `FonteDados` já carregada (usado pelo link de baixar em "Dados importados").
 * `null` cobre os relatórios derivados (ex.: comparativo interanual), que não têm
 * `fase` preenchida e vivem em "03 - Indicadores"; cada fase busca só dentro da sua
 * própria pasta para não confundir arquivos de mesmo nome em fases diferentes (ex.:
 * "Matriz Distribuição Orçamentária 2027.xlsx" existe tanto na 5ª fase quanto,
 * por engano da própria MDO, dentro da 2ª fase por aluno — ver
 * `conferenciaExtracaoAluno`).
 */
function pastaBaseDaFase(fase: string | null): string[] {
  switch (fase) {
    case "F2_CONFERENCIA_EXTRACAO":
      return [path.join(EXPORTADOS, "01 - Matriz orçamentária", "2a fase - Conferência Extração PNP")];
    case "F5_PROPOSTA":
      // As duas pastas: a oficial, e a fonte alternativa de 2026 (fora de
      // "Exportados", ver `FONTE_ALTERNATIVA_2026`).
      return [
        path.join(EXPORTADOS, "01 - Matriz orçamentária", "5a fase - Matriz de Distribuição Orçamentária"),
        path.join(RAIZ_DADOS, "Outras fontes"),
      ];
    case "F6_PARTICIPACAO":
      return [path.join(EXPORTADOS, "01 - Matriz orçamentária", "6a fase - Participação Orçamentária")];
    default:
      return [path.join(EXPORTADOS, "03 - Indicadores")];
  }
}

function buscarArquivoRecursivo(pasta: string, nomeArquivo: string): string | null {
  if (!fs.existsSync(pasta)) return null;
  for (const item of fs.readdirSync(pasta, { withFileTypes: true })) {
    const caminho = path.join(pasta, item.name);
    if (item.isDirectory()) {
      const achado = buscarArquivoRecursivo(caminho, nomeArquivo);
      if (achado) return achado;
    } else if (item.name === nomeArquivo) {
      return caminho;
    }
  }
  return null;
}

/**
 * Acha de volta, no disco, o arquivo original que gerou uma `FonteDados` já
 * carregada — para o link de baixar em "Dados importados". Busca pelo nome exato
 * (`arquivo`) dentro da pasta da fase certa; `null` se não achar (arquivo movido,
 * apagado, ou `MATRIZ2_DADOS` apontando para outro lugar nesta máquina).
 */
export function localizarArquivoOriginal(fase: string | null, nomeArquivo: string): string | null {
  for (const base of pastaBaseDaFase(fase)) {
    const achado = buscarArquivoRecursivo(base, nomeArquivo);
    if (achado) return achado;
  }
  return null;
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

/**
 * Parâmetros da matriz do ciclo que o IFTM publicou depois de um arquivo já ter sido exportado, num CSV baixado à mão
 * (`mdo.iftm.edu.br/Manual/parametros_matriz_<ciclo>_MDO_*.csv`; ponto e vírgula, vírgula decimal). O mais novo vence.
 */
export function parametrosMdoCsv(ano: number): string | null {
  const pasta = caixaCerta(RAIZ_DADOS, "mdo.iftm.edu.br", "Manual");
  if (!fs.existsSync(pasta)) return null;
  const prefixo = `parametros_matriz_${ano}_mdo`;
  let melhor: { caminho: string; quando: number } | null = null;
  for (const nome of fs.readdirSync(pasta)) {
    if (!nome.toLowerCase().startsWith(prefixo) || !nome.toLowerCase().endsWith(".csv")) continue;
    const caminho = path.join(pasta, nome);
    const quando = fs.statSync(caminho).mtimeMs;
    if (!melhor || quando > melhor.quando) melhor = { caminho, quando };
  }
  return melhor?.caminho ?? null;
}

/**
 * Arquivo do Portal da Transparência (CGU): `AAAAMM_Despesas.csv` (execução mensal por UG) ou `AAAA_OrcamentoDespesa.csv`.
 * Fica em "Portal da Transparência/<ano>" ou, como foi baixado, em "Extra - resultados manuais/Outros"; vale a primeira pasta que o tiver.
 */
export function arquivoDoPortal(nome: string): string | null {
  for (const pasta of [["Portal da Transparência", nome.slice(0, 4)], ["Extra - resultados manuais", "Outros"]]) {
    const caminho = caixaCerta(RAIZ_DADOS, ...pasta, nome);
    if (fs.existsSync(caminho)) return caminho;
  }
  return null;
}

/** Pasta dos documentos do orçamento da União (LOA, PLOA e relatórios de emendas): `PLOA e LOA/<ano>/...`. */
export function pastaLoa(...partes: string[]): string {
  return caixaCerta(RAIZ_DADOS, "PLOA e LOA", ...partes);
}

/**
 * Lista dos câmpus que a 5ª fase ONLINE do MDO paga o Piso Mínimo num ciclo, em CSV baixado à mão
 * (`mdo.iftm.edu.br/Manual/piso_minimo_<ciclo>_MDO_5a_fase.csv`, com ou sem prefixo de data; ponto e vírgula; colunas instituicao e campus).
 * Quando existe, ela manda: a aba EXPANSÃO da planilha traz mais câmpus do que o MDO de fato paga.
 */
export function listaPisoMdoCsv(ano: number): string | null {
  const pasta = caixaCerta(RAIZ_DADOS, "mdo.iftm.edu.br", "Manual");
  if (!fs.existsSync(pasta)) return null;
  const alvo = `piso_minimo_${ano}_mdo_5a_fase.csv`;
  let melhor: { caminho: string; quando: number } | null = null;
  for (const nome of fs.readdirSync(pasta)) {
    if (nome.toLowerCase().replace(PREFIXO_DE_DATA, "") !== alvo) continue;
    const caminho = path.join(pasta, nome);
    const quando = fs.statSync(caminho).mtimeMs;
    if (!melhor || quando > melhor.quando) melhor = { caminho, quando };
  }
  return melhor?.caminho ?? null;
}
