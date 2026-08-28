import { parse } from "csv-parse/sync";

/** Uma linha da planilha, já com as quatro colunas identificadas e ainda como texto cru. */
export interface LinhaComposicaoBruta {
  /** Número da linha no arquivo original (1-based), para a mensagem de erro apontar o lugar certo. */
  linha: number;
  modalidade: string;
  fonte: string;
  repasse: string;
  porcentagem: string;
}

/**
 * Sinônimos aceitos para cada coluna. A CONIF publica em .xlsx com "Fonte de Financiamento" (com
 * espaços) e a exportação para CSV costuma virar "FonteFinanciamento" — ambas valem, assim como
 * variações de caixa e acento.
 */
const SINONIMOS: Record<keyof Omit<LinhaComposicaoBruta, "linha">, string[]> = {
  modalidade: ["modalidade", "modalidadeensino", "modalidadedeensino"],
  fonte: ["fontefinanciamento", "fontedefinanciamento", "fonte", "programa", "nomeprograma"],
  repasse: ["repasse", "categoria", "categoriarepasse", "grupo"],
  porcentagem: ["porcentagem", "percentual", "peso", "%"],
};

function chaveCabecalho(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z%]/g, "");
}

/** Localiza, numa matriz de células, a linha de cabeçalho e a posição das quatro colunas. */
function localizarColunas(
  matriz: string[][],
): { indiceCabecalho: number; colunas: Record<keyof Omit<LinhaComposicaoBruta, "linha">, number> } | null {
  // O .xlsx da CONIF traz um título ("Composição de Repasse") na primeira linha e o cabeçalho na
  // segunda; um CSV exportado costuma começar direto no cabeçalho. Em vez de fixar a linha, procura
  // a primeira que contenha as colunas obrigatórias.
  for (let i = 0; i < Math.min(matriz.length, 15); i += 1) {
    const chaves = (matriz[i] ?? []).map(chaveCabecalho);
    const achar = (nomes: string[]) => chaves.findIndex((c) => c !== "" && nomes.includes(c));
    const modalidade = achar(SINONIMOS.modalidade);
    const fonte = achar(SINONIMOS.fonte);
    const repasse = achar(SINONIMOS.repasse);
    const porcentagem = achar(SINONIMOS.porcentagem);
    if (modalidade >= 0 && fonte >= 0 && repasse >= 0 && porcentagem >= 0) {
      return { indiceCabecalho: i, colunas: { modalidade, fonte, repasse, porcentagem } };
    }
  }
  return null;
}

function matrizParaLinhas(matriz: string[][]): LinhaComposicaoBruta[] | null {
  const cabecalho = localizarColunas(matriz);
  if (cabecalho === null) return null;
  const { indiceCabecalho, colunas } = cabecalho;

  const linhas: LinhaComposicaoBruta[] = [];
  for (let i = indiceCabecalho + 1; i < matriz.length; i += 1) {
    const celulas = matriz[i] ?? [];
    const pegar = (indice: number) => (celulas[indice] ?? "").trim();
    const linha: LinhaComposicaoBruta = {
      linha: i + 1,
      modalidade: pegar(colunas.modalidade),
      fonte: pegar(colunas.fonte),
      repasse: pegar(colunas.repasse),
      porcentagem: pegar(colunas.porcentagem),
    };
    // Linha totalmente vazia é separador visual da planilha, não erro de conteúdo.
    if (linha.modalidade === "" && linha.fonte === "" && linha.repasse === "" && linha.porcentagem === "") {
      continue;
    }
    linhas.push(linha);
  }
  return linhas;
}

/**
 * Escolhe o delimitador do CSV olhando as primeiras linhas.
 *
 * NÃO dá para entregar `[";", ","]` ao csv-parse e deixar ele decidir: nos arquivos brasileiros a
 * vírgula é separador decimal ("0,08"), e o parser acabava quebrando o valor em duas colunas.
 * Ponto-e-vírgula tem prioridade justamente por isso — só se ele não aparecer é que a vírgula é
 * tratada como delimitador.
 */
function detectarDelimitador(texto: string): string {
  const amostra = texto.split(/\r?\n/).slice(0, 15).join("\n");
  return amostra.includes(";") ? ";" : ",";
}

/**
 * Converte o valor de uma célula do exceljs em texto. Números vêm como number (0,25 é 0.25, não
 * "25%"), datas e fórmulas precisam do resultado, e `null` vira string vazia.
 */
function celulaParaTexto(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "number" || typeof valor === "boolean") return String(valor);
  if (typeof valor === "string") return valor;
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === "object") {
    const obj = valor as { result?: unknown; text?: unknown; richText?: { text?: string }[] };
    if (obj.result !== undefined) return celulaParaTexto(obj.result);
    if (typeof obj.text === "string") return obj.text;
    if (Array.isArray(obj.richText)) return obj.richText.map((p) => p.text ?? "").join("");
  }
  return String(valor);
}

/**
 * Lê a Composição de Repasse de um arquivo **.xlsx ou .csv**, devolvendo as linhas cruas.
 *
 * A CONIF publica a planilha em .xlsx (com uma linha de título antes do cabeçalho) e o mesmo
 * conteúdo circula convertido para .csv; os dois entram aqui sem conversão manual. O cabeçalho é
 * localizado por conteúdo, não por posição fixa, e os nomes das colunas admitem variações — o que
 * também absorve a diferença entre os ciclos (em 2026 os programas se chamavam "APRENDA MAIS" e
 * "OUTROS MOOC"; em 2027, "MOOC - Aprenda Mais" e "MOOC - Outros"). A classificação é lida da coluna
 * Repasse, então mudança de nomenclatura dos programas não quebra a importação.
 */
export async function lerPlanilhaComposicao(
  nomeArquivo: string,
  conteudo: ArrayBuffer,
): Promise<{ ok: true; linhas: LinhaComposicaoBruta[] } | { ok: false; erro: string }> {
  const ehXlsx = /\.xlsx$/i.test(nomeArquivo);

  let matriz: string[][];
  if (ehXlsx) {
    try {
      // Import dinâmico: o exceljs só é carregado quando alguém envia .xlsx, mantendo o custo fora
      // do caminho comum (CSV) e do bundle das telas.
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(conteudo);
      const planilha = workbook.worksheets[0];
      if (planilha === undefined) {
        return { ok: false, erro: "A planilha enviada não tem nenhuma aba." };
      }
      matriz = [];
      planilha.eachRow({ includeEmpty: true }, (row) => {
        const celulas: string[] = [];
        // `row.values` do exceljs é 1-based (a posição 0 vem vazia).
        const valores = row.values as unknown[];
        for (let c = 1; c < valores.length; c += 1) {
          celulas.push(celulaParaTexto(valores[c]));
        }
        matriz.push(celulas);
      });
    } catch (error) {
      return {
        ok: false,
        erro: `Não foi possível ler o .xlsx: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  } else {
    try {
      const texto = new TextDecoder("utf-8").decode(conteudo);
      // `columns: false` devolve matriz de strings — o cabeçalho é localizado depois, porque nem
      // sempre está na primeira linha.
      matriz = parse(texto, {
        delimiter: detectarDelimitador(texto),
        columns: false,
        skip_empty_lines: false,
        trim: true,
        bom: true,
        relax_column_count: true,
      }) as string[][];
    } catch (error) {
      return {
        ok: false,
        erro: `CSV inválido: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  const linhas = matrizParaLinhas(matriz);
  if (linhas === null) {
    return {
      ok: false,
      erro:
        "Não encontrei as colunas obrigatórias no arquivo. São esperadas quatro colunas — " +
        "Modalidade, Fonte de Financiamento, Repasse e Porcentagem — em alguma das primeiras linhas.",
    };
  }
  return { ok: true, linhas };
}
