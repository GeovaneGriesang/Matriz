/**
 * Leitura do texto de um PDF da LOA ou do PLOA (volume de "Detalhamento das Ações", páginas de uma unidade orçamentária), extraído com
 * `pdftotext -raw`. Duas partes: o "Quadro Síntese" (totais por exercício) e o "Quadro dos Créditos Orçamentários" (uma linha por
 * crédito: esfera, grupo de despesa, resultado primário, modalidade, identificador de uso e fonte, com o valor).
 *
 * O modo `-raw` mantém cada linha do PDF inteira; o modo `-layout` embaralha as colunas de valor. As duas edições (LOA e PLOA) escrevem a
 * linha de crédito de jeitos quase iguais: "F 3-ODC 2 90 8 1000 44.027.867" e "F 3 - ODC 2 90 8 1000 48.207.046".
 */

export interface LinhaCredito {
  programa: string;
  acao: string;
  localizador: string;
  gnd: number;
  resultadoPrimario: number;
  modalidade: number;
  fonteRecurso: number;
  valor: number;
  produto: string | null;
  meta: number | null;
}

export interface TotalQuadro {
  documento: "PLOA" | "LOA" | "LEI_CREDITOS" | "EMPENHADO";
  exercicio: number;
  valor: number;
}

/** Nome oficial das ações que aparecem nas instituições da rede. Uma ação fora desta lista é lida com o código no lugar do nome. */
export const NOME_DA_ACAO: Record<string, string> = {
  "2004": "Assistência Médica e Odontológica aos Servidores Civis, Empregados, Militares e seus Dependentes",
  "20TP": "Ativos Civis da União",
  "212B": "Benefícios Obrigatórios aos Servidores Civis, Empregados, Militares e seus Dependentes",
  "216H": "Ajuda de Custo para Moradia ou Auxílio-Moradia a Agentes Públicos",
  "4572": "Capacitação de Servidores Públicos Federais em Processo de Qualificação e Requalificação",
  "0181": "Aposentadorias e Pensões Civis da União",
  "09HB": "Contribuição da União, de suas Autarquias e Fundações para o Custeio do Regime de Previdência dos Servidores Públicos Federais",
  "00S6": "Benefício Especial (Lei nº 12.618, de 2012)",
  "00PW": "Contribuições Regulares a Entidades ou Organismos Nacionais sem Exigência de Programação Específica",
  "20RG": "Reestruturação e Modernização das Instituições da Rede Federal de Educação Profissional, Científica e Tecnológica",
  "20RL": "Funcionamento das Instituições da Rede Federal de Educação Profissional, Científica e Tecnológica",
  "21B3": "Fomento às Ações de Ensino, Pesquisa, Extensão, Inovação e Sustentabilidade na Educação Profissional e Tecnológica",
  "21IH": "Assistência para Atendimento a Pessoas com Deficiência",
  "21IV": "Apoio à Alimentação do Estudante da Rede Federal de Educação Profissional, Científica e Tecnológica (RFEPCT)",
  "2994": "Assistência aos Estudantes da Rede Federal de Educação Profissional, Científica e Tecnológica",
};

function numero(s: string): number {
  return Number(s.replace(/\./g, "").replace(",", "."));
}

const CREDITO = /^([FS]) (\d) ?- ?([A-Z]+) (\d) (\d{2}) (\d) (\d{4}) ([\d.]+)$/;
const LOCALIZADOR = /^(\d{4}) ([0-9A-Z]{4}) (\d{4})\b/;
const PRODUTO = /^(?:Produto: )?(.+?) \(unidade\): ([\d.]+)$/;

/** Os créditos da unidade, na ordem do documento. A ação vem da linha de localizador ("5112 20RL 0043") que antecede os créditos. */
export function lerCreditos(texto: string): LinhaCredito[] {
  const linhas: LinhaCredito[] = [];
  let atual: { programa: string; acao: string; localizador: string } | null = null;
  const produtoDaAcao = new Map<string, { produto: string; meta: number }>();
  for (const bruta of texto.split(/\r?\n/)) {
    const l = bruta.trim();
    const loc = LOCALIZADOR.exec(l);
    if (loc) {
      atual = { programa: loc[1]!, acao: loc[2]!, localizador: loc[3]! };
      continue;
    }
    const c = CREDITO.exec(l);
    if (c && atual) {
      linhas.push({
        ...atual,
        gnd: Number(c[2]),
        resultadoPrimario: Number(c[4]),
        modalidade: Number(c[5]),
        fonteRecurso: Number(c[7]),
        valor: numero(c[8]!),
        produto: null,
        meta: null,
      });
      continue;
    }
    const p = PRODUTO.exec(l);
    if (p && atual) produtoDaAcao.set(`${atual.acao}:${atual.localizador}`, { produto: `${p[1]!} (unidade)`, meta: numero(p[2]!) });
  }
  // O produto aparece depois do primeiro crédito da ação e vale para todos os da ação e do localizador (inclusive os que vêm depois dele).
  for (const c of linhas) {
    const pm = produtoDaAcao.get(`${c.acao}:${c.localizador}`);
    if (pm) {
      c.produto = pm.produto;
      c.meta = pm.meta;
    }
  }
  return linhas;
}

/**
 * Os totais do Quadro Síntese. A linha "Total" traz quatro números e o quinto vem solto, e a ordem das colunas muda de documento para
 * documento (o cabeçalho sai embaralhado no texto), então cada documento tem a sua ordem conhecida.
 */
export function lerTotaisDoQuadroSintese(
  texto: string,
  ordem: { colunas: [TotalQuadro["documento"], number][]; solto: [TotalQuadro["documento"], number] },
): TotalQuadro[] {
  const linhas = texto.split(/\r?\n/).map((l) => l.trim());
  const i = linhas.findIndex((l) => /^Total (?:[\d.]+ ){3}[\d.]+$/.test(l));
  if (i < 0) throw new Error("Quadro Síntese sem a linha Total com quatro valores; o layout do PDF mudou?");
  const quatro = linhas[i]!.split(" ").slice(1).map(numero);
  const j = linhas.slice(i + 1, i + 12).findIndex((l) => /^[\d.]+$/.test(l) && l.length >= 9);
  if (j < 0) throw new Error("Quadro Síntese sem o quinto total; o layout do PDF mudou?");
  const solto = numero(linhas[i + 1 + j]!);
  return [
    ...ordem.colunas.map(([documento, exercicio], k) => ({ documento, exercicio, valor: quatro[k]! })),
    { documento: ordem.solto[0], exercicio: ordem.solto[1], valor: solto },
  ];
}
