/**
 * Leitura dos relatórios fiscais que o Estado e o município entregam ao Tesouro Nacional (Siconfi). O Relatório Resumido da
 * Execução Orçamentária (RREO) sai a cada bimestre e é igual para todos os entes do país, o que permite comparar o Estado com o
 * município e um ano com outro.
 *
 * Anexo 01 (balanço orçamentário): a receita prevista e a arrecadada, e a despesa por grupo (pessoal, custeio, investimento).
 * Anexo 02: a despesa por função (educação, saúde, segurança...) e subfunção (ensino fundamental, atenção básica...).
 */

export const ENTES = {
  RS: { codIbge: 43, nome: "Estado do Rio Grande do Sul", curto: "Estado do RS" },
  VENANCIO_AIRES: { codIbge: 4322608, nome: "Município de Venâncio Aires", curto: "Venâncio Aires" },
} as const;
export type Ente = keyof typeof ENTES;

export const ANEXO_BALANCO = "RREO-Anexo 01";
export const ANEXO_FUNCAO = "RREO-Anexo 02";

export type ColunaSiconfi =
  | "previsaoInicial"
  | "previsaoAtualizada"
  | "realizado"
  | "dotacaoInicial"
  | "dotacaoAtualizada"
  | "empenhado"
  | "liquidado"
  | "pago";

/** O nome curto de cada coluna acumulada do RREO. As colunas "no bimestre", de percentual e de saldo ficam de fora (saem das outras). */
export function normalizarColuna(coluna: string): ColunaSiconfi | null {
  const c = coluna
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
  if (c.startsWith("%") || c.startsWith("SALDO") || c.includes("NO BIMESTRE") || c.includes("RESTOS A PAGAR")) return null;
  if (c.startsWith("PREVISAO INICIAL")) return "previsaoInicial";
  if (c.startsWith("PREVISAO ATUALIZADA")) return "previsaoAtualizada";
  if (c.startsWith("ATE O BIMESTRE")) return "realizado";
  if (c.startsWith("DOTACAO INICIAL")) return "dotacaoInicial";
  if (c.startsWith("DOTACAO ATUALIZADA")) return "dotacaoAtualizada";
  if (c.startsWith("DESPESAS EMPENHADAS ATE")) return "empenhado";
  if (c.startsWith("DESPESAS LIQUIDADAS ATE")) return "liquidado";
  if (c.startsWith("DESPESAS PAGAS ATE")) return "pago";
  return null;
}

const semAcento = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** As 28 funções de governo da Portaria MOG 42/1999, que valem para a União, os estados e os municípios. */
export const FUNCOES_DE_GOVERNO = [
  "Legislativa",
  "Judiciária",
  "Essencial à Justiça",
  "Administração",
  "Defesa Nacional",
  "Segurança Pública",
  "Relações Exteriores",
  "Assistência Social",
  "Previdência Social",
  "Saúde",
  "Trabalho",
  "Educação",
  "Cultura",
  "Direitos da Cidadania",
  "Urbanismo",
  "Habitação",
  "Saneamento",
  "Gestão Ambiental",
  "Ciência e Tecnologia",
  "Agricultura",
  "Organização Agrária",
  "Indústria",
  "Comércio e Serviços",
  "Comunicações",
  "Energia",
  "Transporte",
  "Desporto e Lazer",
  "Encargos Especiais",
] as const;

const FUNCOES_NORMALIZADAS = new Set(FUNCOES_DE_GOVERNO.map(semAcento));

/** Uma linha do Anexo 02 é função, subfunção ou total. A reserva de contingência entra como função, porque não tem subfunção. */
export function ehFuncao(conta: string): boolean {
  const c = semAcento(conta);
  return FUNCOES_NORMALIZADAS.has(c) || c.startsWith("reserva");
}

export function ehTotal(conta: string): boolean {
  return /^(DESPESAS|TOTAL)\b/.test(conta.trim());
}

export interface ItemSiconfi {
  instituicao?: string;
  anexo: string;
  rotulo: string;
  coluna: string;
  cod_conta: string;
  conta: string;
  valor: number;
}

/**
 * Consórcios intermunicipais entregam o relatório com o código IBGE do município sede (em 2019 e 2020, o CISVALE aparece junto
 * com a Prefeitura de Venâncio Aires). Fica só o relatório da Prefeitura ou do Governo do Estado: o de quem não é consórcio, e,
 * havendo mais de um, o com mais linhas.
 */
export function doProprioEnte(itens: readonly ItemSiconfi[]): ItemSiconfi[] {
  const contagem = new Map<string, number>();
  for (const i of itens) if (!/cons[oó]rcio/i.test(i.instituicao ?? "")) contagem.set(i.instituicao ?? "", (contagem.get(i.instituicao ?? "") ?? 0) + 1);
  const escolhida = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return escolhida === undefined ? [] : itens.filter((i) => (i.instituicao ?? "") === escolhida);
}

export interface LinhaSiconfi {
  anexo: string;
  ordem: number;
  codConta: string;
  conta: string;
  nivel: string;
  funcao: string | null;
  coluna: ColunaSiconfi;
  valor: number;
}

/**
 * Transforma os itens do RREO devolvidos pela API em linhas da tabela. No Anexo 02 fica só o quadro sem as despesas
 * intraorçamentárias (o pagamento de um órgão a outro do mesmo ente, que contaria duas vezes), e cada subfunção leva o nome da
 * função de cima. No Anexo 01, cada conta é marcada como receita ou despesa pela posição em que aparece.
 */
export function linhasDoRreo(todos: readonly ItemSiconfi[]): LinhaSiconfi[] {
  const itens = doProprioEnte(todos);
  const saida: LinhaSiconfi[] = [];
  const porAnexo = new Map<string, ItemSiconfi[]>();
  for (const i of itens) porAnexo.set(i.anexo, [...(porAnexo.get(i.anexo) ?? []), i]);

  const anexo02 = (porAnexo.get(ANEXO_FUNCAO) ?? []).filter((i) => !i.rotulo || /exceto intra/i.test(i.rotulo));
  // A API devolve coluna por coluna, cada uma com as contas na ordem do relatório: a função de uma subfunção é a última função
  // vista naquela coluna. O nome sozinho não basta ("Administração Geral" aparece sob várias funções no relatório do Estado).
  const ordem02 = new Map<string, number>();
  const funcaoNaColuna = new Map<string, string | null>();
  for (const i of anexo02) {
    let nivel = "subfuncao";
    let funcao = funcaoNaColuna.get(i.coluna) ?? null;
    if (ehTotal(i.conta)) {
      nivel = "total";
      funcao = null;
    } else if (ehFuncao(i.conta)) {
      nivel = "funcao";
      funcao = i.conta;
    }
    funcaoNaColuna.set(i.coluna, funcao);
    const coluna = normalizarColuna(i.coluna);
    if (!coluna || (nivel === "subfuncao" && funcao === null)) continue;
    const chave = `${funcao ?? ""}|${i.conta}`;
    if (!ordem02.has(chave)) ordem02.set(chave, ordem02.size);
    saida.push({ anexo: ANEXO_FUNCAO, ordem: ordem02.get(chave)!, codConta: i.cod_conta, conta: i.conta, nivel, funcao, coluna, valor: i.valor });
  }

  const anexo01 = porAnexo.get(ANEXO_BALANCO) ?? [];
  const ordem01 = new Map<string, number>();
  for (const i of anexo01) {
    const chave = `${i.cod_conta}|${i.conta}`;
    if (!ordem01.has(chave)) ordem01.set(chave, ordem01.size);
  }
  for (const i of anexo01) {
    const coluna = normalizarColuna(i.coluna);
    const ordem = ordem01.get(`${i.cod_conta}|${i.conta}`);
    if (!coluna || ordem === undefined) continue;
    // As colunas de previsão e de arrecadado só existem na parte da receita; as de dotação e empenho, só na despesa.
    const nivel = coluna.startsWith("previsao") || coluna === "realizado" ? "receita" : "despesa";
    saida.push({ anexo: ANEXO_BALANCO, ordem, codConta: i.cod_conta, conta: i.conta, nivel, funcao: null, coluna, valor: i.valor });
  }
  return saida;
}
