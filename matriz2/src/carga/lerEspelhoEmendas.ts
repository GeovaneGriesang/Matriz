/**
 * Lê o espelho das emendas de despesa do projeto de lei orçamentária (o "Avulso de Emendas" que a Comissão Mista de Orçamento
 * publica em PDF), depois de convertido em texto com `pdftotext -enc UTF-8 -raw`.
 *
 * Cada emenda começa com "Avulso de Emendas", "EMENDA" e o número de 8 dígitos (4 do autor e 4 da sequência). Uma emenda
 * longa continua nas páginas seguintes, que repetem o cabeçalho e seguem com "JUSTIFICATIVA" sem número novo; essas páginas
 * pertencem à emenda anterior. O autor ("AUTOR DA EMENDA", tipo, "TIPO AUTOR", "código - nome") vem no rodapé de cada página.
 *
 * Os acréscimos trazem, para cada linha, a natureza ("Outras Despesas Correntes", "Investimentos"...), a modalidade de
 * aplicação, o RP e o valor, e na linha seguinte o GND e o código da modalidade ("3 90"). O total confere com a soma.
 */

export interface AcrescimoEmenda {
  gnd: number;
  modalidadeAplicacao: string;
  valor: number;
}

export interface EmendaDoEspelho {
  numero: string;
  /** "Individual", "Bancada Estadual", "Comissão"... */
  modalidade: string;
  /** Deputado Federal, Senador, Bancada Estadual, Comissão Permanente... */
  tipoAutor: string;
  autorCodigo: string;
  autor: string;
  ementa: string;
  orgao: string;
  uoCodigo: string;
  uoNome: string;
  funcional: string;
  acao: string;
  acaoDescricao: string;
  subtitulo: string;
  localidade: string;
  acrescimos: AcrescimoEmenda[];
  total: number;
  justificativa: string;
}

const CABECALHO = new Set([
  "Congresso Nacional",
  "Comissão Mista de Planos, Orçamentos Públicos e Fiscalização",
  "Lexor - Sistemas de Leis Orçamentárias",
  "Avulso de Emendas",
]);

function numeroBr(s: string): number {
  return Number(s.replace(/\./g, "").replace(",", "."));
}

/** O valor da linha que vem logo depois do rótulo. */
function depoisDe(linhas: string[], rotulo: string): string {
  const i = linhas.indexOf(rotulo);
  return i >= 0 && i + 1 < linhas.length ? linhas[i + 1]! : "";
}

function separarCodigo(s: string): [string, string] {
  const m = s.match(/^(\S+) - (.*)$/);
  return m ? [m[1]!, m[2]!.trim()] : ["", s.trim()];
}

function lerBloco(linhas: string[]): EmendaDoEspelho {
  const numero = linhas[1]!;
  const modalidade = depoisDe(linhas, "MODALIDADE DE EMENDA");
  // A ementa fica entre o tipo de autor (logo depois do número) e o rótulo "EMENTA".
  const iEmenta = linhas.indexOf("EMENTA");
  const ementa = iEmenta > 4 ? linhas.slice(4, iEmenta).join(" ").trim() : "";
  const [uoCodigo, uoNome] = separarCodigo(depoisDe(linhas, "UNIDADE ORÇAMENTÁRIA"));
  const funcional = (linhas.find((l) => l.startsWith("FUNCIONAL PROGRAMÁTICA")) ?? "").replace("FUNCIONAL PROGRAMÁTICA", "").trim();
  // O código da ação é o 4º trecho da funcional (12.363.5112.20RL.0043). Quando a funcional vem incompleta, vale o código no início
  // da descrição. A descrição pode quebrar em várias linhas antes do rótulo "AÇÃO".
  const iAcao = linhas.indexOf("AÇÃO");
  let iDesc = iAcao - 1;
  while (iDesc > 0 && !/^[0-9A-Z]{4} - /.test(linhas[iDesc]!) && iAcao - iDesc < 4) iDesc--;
  const linhaDesc = iDesc > 0 && /^[0-9A-Z]{4} - /.test(linhas[iDesc]!) ? linhas.slice(iDesc, iAcao).join(" ") : "";
  const [codigoNaDescricao, acaoDescricao] = linhaDesc ? separarCodigo(linhaDesc) : ["", ""];
  const acao = funcional.split(".")[3] || codigoNaDescricao;

  const acrescimos: AcrescimoEmenda[] = [];
  let total = 0;
  const iAcr = linhas.indexOf("ACRÉSCIMOS À PROGRAMAÇÃO");
  if (iAcr >= 0) {
    for (let i = iAcr + 1; i < linhas.length; i++) {
      const l = linhas[i]!;
      const t = l.match(/^TOTAL: ([\d.]+)$/);
      if (t) {
        total = numeroBr(t[1]!);
        break;
      }
      const v = l.match(/^(.*\S) (\d+) ([\d.]+)$/);
      const g = (linhas[i + 1] ?? "").match(/^(\d) (\d{2})$/);
      if (v && g && !l.startsWith("GND ")) {
        acrescimos.push({ gnd: Number(g[1]), modalidadeAplicacao: g[2]!, valor: numeroBr(v[3]!) });
        i++;
      }
    }
  }

  // Justificativa: de "JUSTIFICATIVA" até o rodapé do autor, em todas as páginas da emenda.
  const partes: string[] = [];
  let dentro = false;
  for (const l of linhas) {
    if (l === "JUSTIFICATIVA") {
      dentro = true;
      continue;
    }
    if (l === "AUTOR DA EMENDA") {
      dentro = false;
      continue;
    }
    if (dentro && !CABECALHO.has(l) && !l.startsWith("PLN ")) partes.push(l);
  }

  const iAutor = linhas.indexOf("AUTOR DA EMENDA");
  const tipoAutor = iAutor >= 0 ? (linhas[iAutor + 1] ?? "") : "";
  const [autorCodigo, autor] = iAutor >= 0 ? separarCodigo(linhas[iAutor + 3] ?? "") : ["", ""];

  return {
    numero,
    modalidade,
    tipoAutor,
    autorCodigo,
    autor,
    ementa,
    orgao: depoisDe(linhas, "ÓRGÃO ORÇAMENTÁRIO"),
    uoCodigo,
    uoNome,
    funcional,
    acao,
    acaoDescricao,
    subtitulo: depoisDe(linhas, "SUBTÍTULO"),
    localidade: depoisDe(linhas, "LOCALIDADE BENEFICIADA"),
    acrescimos,
    total,
    justificativa: partes.join(" ").replace(/\*\*JUSTIFICATIVA\*\*/g, "").replace(/\s+/g, " ").trim(),
  };
}

/** Todas as emendas do espelho, na ordem do arquivo. */
export function lerEspelhoEmendas(texto: string): EmendaDoEspelho[] {
  const linhas = texto.replace(/\f/g, "\n").split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== "");
  const emendas: EmendaDoEspelho[] = [];
  let atual: string[] | null = null;
  for (let i = 0; i < linhas.length; i++) {
    if (linhas[i] === "EMENDA" && linhas[i - 1] === "Avulso de Emendas" && /^\d{8}$/.test(linhas[i + 1] ?? "")) {
      if (atual && atual[1] !== linhas[i + 1]) {
        emendas.push(lerBloco(atual));
        atual = null;
      }
      if (!atual) atual = [];
      atual.push(...(atual.length === 0 ? [linhas[i]!, linhas[i + 1]!] : []));
      i++;
      continue;
    }
    if (atual) atual.push(linhas[i]!);
  }
  if (atual) emendas.push(lerBloco(atual));
  return emendas;
}

/** Os números das emendas que constam no recibo de entrega (as que o autor efetivamente entregou). */
export function lerRecibos(texto: string): Set<string> {
  const s = new Set<string>();
  for (const l of texto.split(/\r?\n/)) {
    const m = l.trim().match(/^(\d{8}) /);
    if (m) s.add(m[1]!);
  }
  return s;
}
