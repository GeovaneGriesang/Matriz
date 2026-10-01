/**
 * Leitura dos CSVs do painel "Dados de Ensino" da Plataforma Nilo Peçanha, baixados à
 * mão (ver PNP_2027_LEIA-ME.txt): ponto e vírgula, decimal com vírgula, UTF-8 com BOM,
 * percentuais em fração, oito colunas de estrutura e depois as colunas do indicador.
 *
 * Só funções puras, para poderem ser testadas sem arquivo.
 */

/** As colunas que identificam a estrutura e o ano, iguais em todos os arquivos. */
export const COLUNAS_ESTRUTURA = [
  "Nível",
  "Ano Base",
  "Instituição",
  "Organização Acadêmica",
  "Região",
  "Estado",
  "Campus / Estrutura",
  "Município",
] as const;

/** Colunas que classificam a linha (texto que filtra), em vez de medir algo. */
export const COLUNAS_CATEGORICAS = new Set([
  "Categoria da Situação",
  "Situação",
  "Fluxo Escolar",
  "Tipo de Reserva de Vaga",
]);

/**
 * Divide uma linha de CSV por ponto e vírgula, respeitando aspas. O caso comum (sem
 * aspas) não paga o custo do analisador caractere a caractere: são 6 milhões de linhas.
 */
export function dividirLinha(linha: string): string[] {
  const limpa = linha.charCodeAt(0) === 0xfeff ? linha.slice(1) : linha;
  if (!limpa.includes('"')) return limpa.split(";");
  const campos: string[] = [];
  let atual = "";
  let dentro = false;
  for (let i = 0; i < limpa.length; i++) {
    const c = limpa[i]!;
    if (dentro) {
      if (c === '"') {
        if (limpa[i + 1] === '"') {
          atual += '"';
          i++;
        } else {
          dentro = false;
        }
      } else {
        atual += c;
      }
    } else if (c === '"') {
      dentro = true;
    } else if (c === ";") {
      campos.push(atual);
      atual = "";
    } else {
      atual += c;
    }
  }
  campos.push(atual);
  return campos;
}

const NUMERO_SIMPLES = /^-?\d+(,\d+)?$/;
const NUMERO_COM_MILHAR = /^-?\d{1,3}(\.\d{3})+(,\d+)?$/;

/**
 * Converte uma célula: vazio vira `undefined` (a coluna nem entra no JSON), número com
 * vírgula decimal vira `number`, e qualquer outra coisa ("(+3,66)", "(-3,6%)", "Ref.")
 * fica como texto, porque a PNP mistura valor e legenda na mesma coluna.
 */
export function converterCelula(bruto: string | undefined): number | string | undefined {
  if (bruto === undefined) return undefined;
  const t = bruto.trim();
  if (t === "") return undefined;
  if (NUMERO_SIMPLES.test(t)) return Number(t.replace(",", "."));
  if (NUMERO_COM_MILHAR.test(t)) return Number(t.replace(/\./g, "").replace(",", "."));
  return t;
}

/**
 * Rótulos únicos para as colunas de um arquivo. O painel repete o título do cartão em
 * várias colunas ("Matrículas", "Matrículas"), e como os valores vão para um JSON
 * indexado pelo rótulo, a segunda ocorrência ganha o sufixo " (2)", a terceira " (3)".
 */
export function rotulosUnicos(cabecalho: string[]): string[] {
  const vistos = new Map<string, number>();
  return cabecalho.map((r) => {
    const base = r.trim();
    const n = (vistos.get(base) ?? 0) + 1;
    vistos.set(base, n);
    return n === 1 ? base : `${base} (${n})`;
  });
}

export interface ClasseArquivo {
  aba: string;
  subaba: string;
  /** Vazia na tabela principal; "Renda Familiar", "Eixo Tecnológico"... nos detalhamentos. */
  dimensao: string;
}

/**
 * Descobre aba, subaba e dimensão pelo caminho relativo à pasta "Dados do Ensino":
 *   <Aba>/<Subaba>.csv
 *   <Aba>/<Subaba> - detalhamentos/<Subaba> - por <Dimensão>.csv
 */
export function classificarArquivo(caminhoRelativo: string): ClasseArquivo | null {
  const partes = caminhoRelativo.split(/[\\/]/).filter(Boolean);
  if (partes.length < 2 || !partes[partes.length - 1]!.toLowerCase().endsWith(".csv")) return null;
  const aba = partes[0]!;
  const arquivo = partes[partes.length - 1]!.replace(/\.csv$/i, "");
  if (partes.length === 2) return { aba, subaba: arquivo, dimensao: "" };
  const m = arquivo.match(/^(.*) - por (.*)$/);
  if (partes.length === 3 && m) return { aba, subaba: m[1]!, dimensao: m[2]! };
  return null;
}

/**
 * A Série Histórica repete, com o mesmo número, a tabela "Curso, Matrícula e Oferta"
 * nestas aberturas; importá-las duas vezes só dobraria as linhas. As aberturas que só a
 * Série Histórica tem (raça, renda, sexo) continuam entrando.
 */
export const ABERTURAS_REPETIDAS_NA_SERIE = new Set([
  "Eixo Tecnológico",
  "Fonte de Financiamento",
  "Modalidade de Ensino",
  "Nome do Curso",
  "Programa",
  "Subeixo Tecnológico",
  "Tipo de Curso",
  "Tipo de Oferta",
  "Turno do Curso",
]);

export function deveIgnorar(c: ClasseArquivo): boolean {
  if (c.subaba !== "Série Histórica") return false;
  return c.dimensao === "" || ABERTURAS_REPETIDAS_NA_SERIE.has(c.dimensao);
}

/** Nome para casar estruturas da PNP com as do sistema: sem acento, caixa alta, só letras e números. */
export function normalizarNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export type NivelPnpTexto = "REDE" | "REGIAO" | "ESTADO" | "INSTITUICAO" | "CAMPUS";

export function nivelDoTexto(texto: string): NivelPnpTexto | null {
  const t = normalizarNome(texto);
  if (t === "REDE") return "REDE";
  if (t === "REGIAO") return "REGIAO";
  if (t === "ESTADO") return "ESTADO";
  if (t === "INSTITUICAO") return "INSTITUICAO";
  if (t === "CAMPUS") return "CAMPUS";
  return null;
}

// ---------------------------------------------------------------------------
// Painel "Dados Orçamentários"
// ---------------------------------------------------------------------------

/** Colunas que identificam a linha no painel orçamentário; o resto é abertura ou medida. */
export const COLUNAS_FIXAS_ORCAMENTO = new Set([
  "Nível",
  "Ano Base",
  "Mês",
  "Tipo de Valor",
  "Relação do Órgão",
  "Instituição",
  "Organização Acadêmica",
  "Região",
  "Estado",
]);

/** As aberturas ("Detalhar linhas por") do painel orçamentário, quando aparecem como coluna. */
export const COLUNAS_DIMENSAO_ORCAMENTO = new Set([
  "Ação Orçamentária",
  "Elemento de Despesa",
  "Fonte de Recursos",
  "Grupo de Despesas (GND)",
  "Identificador de Resultado (RP)",
  "Item de Despesa",
  "Natureza de Despesa Detalhada",
  "Plano Orçamentário",
  "Programa Orçamentário",
  "Unidade Orçamentária",
]);

/**
 * Aba, subaba e abertura de um arquivo do painel orçamentário, pelo caminho relativo à pasta
 * "Dados Orçamentários":
 *   Explorar Dados/<Contexto>/Explorar Dados - <Contexto>[ - por <Abertura>].csv
 *   <Aba>/<Aba>[ - por <Abertura>].csv   (Gastos Totais, Indicadores, Panorama, Série Histórica)
 */
export function classificarArquivoOrcamento(caminhoRelativo: string): ClasseArquivo | null {
  const partes = caminhoRelativo.split(/[\\/]/).filter(Boolean);
  const ultimo = partes[partes.length - 1];
  if (!ultimo || !ultimo.toLowerCase().endsWith(".csv")) return null;
  const arquivo = ultimo.replace(/\.csv$/i, "");
  const abertura = arquivo.match(/ - por (.*)$/)?.[1] ?? "";
  if (partes.length === 3 && partes[0] === "Explorar Dados") return { aba: "Explorar Dados", subaba: partes[1]!, dimensao: abertura };
  if (partes.length === 2) return { aba: partes[0]!, subaba: partes[0]!, dimensao: abertura };
  return null;
}
