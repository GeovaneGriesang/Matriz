import { dividirLinha } from "./csvPainel";

/**
 * Agregação dos microdados de matrículas da PNP (`microdados_matriculas_<ano>.csv.gz`) por CICLO DE CURSO.
 *
 * Cada linha do arquivo é UMA matrícula de estudante (79 colunas, sem nome nem CPF, mas com idade, sexo,
 * raça e renda). O que a matriz da MDO usa não é a matrícula individual: é o ciclo, com sua carga horária,
 * datas, quantidade de alunos e situação deles. Por isso o sistema guarda o microdado já agregado por
 * ciclo e não guarda uma linha por estudante: preserva tudo que o cálculo usa e não carrega dado pessoal
 * (e são mais de 20 milhões de linhas em 2017 a 2025).
 *
 * Só funções puras sobre linhas de texto, para poder testar sem arquivo e reaproveitar na análise.
 */

export interface CicloMicrodado {
  ano: number;
  ciclo: string;
  coInst: string;
  codUnidade: string;
  codUnidadeSistec: string;
  instituicao: string;
  unidadeEnsino: string;
  uf: string;
  codMunicipio: string;
  cursoEmec: string;
  nomeCurso: string;
  tipoCurso: string;
  tipoOferta: string;
  modalidade: string;
  fonteFinanciamento: string;
  programa: string;
  eixo: string;
  subeixo: string;
  turno: string;
  formacaoProfessores: boolean;
  /** Carga horária do ciclo (CHC) e mínima regulamentada (CHMR); a PNP entrega as duas por matrícula. */
  cargaHoraria: number | null;
  cargaHorariaMinima: number | null;
  /** Fator de Esforço do Curso (Portaria Setec 146/2021). Não é o "peso do curso" da MDO. */
  fatorEsforco: number | null;
  inicio: string | null;
  fimPrevisto: string | null;
  vagas: number | null;
  inscritos: number | null;
  /** Todas as matrículas do ciclo que aparecem no arquivo do ano. */
  matriculas: number;
  /** As que estiveram ativas pelo menos um dia no ano (a "matrícula atendida" da PNP). */
  atendidas: number;
  /** Matrículas por "Categoria da Situação | Situação de Matrícula". */
  porSituacao: Record<string, number>;
  /** Matrículas por faixa de renda familiar per capita. */
  porRenda: Record<string, number>;
}

/** "28/12/2025" para "2025-12-28"; vazio ou inválido para null. */
export function dataBrParaIso(texto: string): string | null {
  const m = texto.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function numeroOuNulo(texto: string | undefined): number | null {
  if (texto === undefined) return null;
  const t = texto.trim();
  if (t === "") return null;
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const COLUNAS_USADAS = {
  ano: "Ano",
  ch: "Carga Horaria",
  chMin: "Carga Horaria Mínima",
  categoria: "Categoria da Situação",
  coInst: "Co Inst",
  codUnidade: "Cod Unidade",
  codUnidadeSistec: "Código da Unidade de Ensino - SISTEC",
  ciclo: "Código do Ciclo Matricula",
  cursoEmec: "Código do Curso - eMEC",
  codMunicipio: "Código do Município com DV",
  fim: "Data de Fim Previsto do Ciclo",
  inicio: "Data de Inicio do Ciclo",
  eixo: "Eixo Tecnológico",
  fec: "Fator Esforço Curso",
  fonte: "Fonte de Financiamento",
  formacao: "Formação de Professores",
  instituicao: "Instituição",
  atendida: "Matrícula Atendida",
  modalidade: "Modalidade de Ensino",
  nomeCurso: "Nome de Curso",
  programa: "Programa Associado",
  renda: "Renda Familiar",
  situacao: "Situação de Matrícula",
  subeixo: "Subeixo Tecnológico",
  tipoCurso: "Tipo de Curso",
  tipoOferta: "Tipo de Oferta",
  inscritos: "Total de Inscritos",
  turno: "Turno",
  uf: "UF",
  unidade: "Unidade de Ensino",
  vagas: "Vagas Ofertadas",
} as const;

/**
 * Colunas sem as quais não há como agregar. As demais podem faltar: o layout dos arquivos mudou ao longo dos
 * anos (2017 a 2022 têm 54 ou 55 colunas, 2023 tem 56, 2024 tem 73 e 2025 tem 79) e as colunas que só existem
 * nos anos recentes (programa associado, curso do eMEC, formação de professores...) ficam vazias nos antigos.
 */
const COLUNAS_OBRIGATORIAS: (keyof typeof COLUNAS_USADAS)[] = ["ano", "ciclo", "instituicao", "unidade"];

export class AgregadorMatriculas {
  private indices: Record<keyof typeof COLUNAS_USADAS, number> | null = null;
  /**
   * Nos arquivos de 2017 a 2023 cada linha já é um grupo de matrículas iguais, com a quantidade na coluna
   * "Número de registros"; de 2024 em diante cada linha é uma matrícula. Sem a coluna, o peso da linha é 1.
   */
  private colunaRegistros = -1;
  readonly ciclos = new Map<string, CicloMicrodado>();
  linhas = 0;
  linhasSemCiclo = 0;

  /** Alimenta uma linha do CSV (a primeira é o cabeçalho). Devolve false se a linha foi descartada. */
  adicionar(linha: string): boolean {
    if (!linha) return false;
    const c = dividirLinha(linha);
    if (!this.indices) {
      const cab = c.map((x) => x.trim());
      const idx = {} as Record<keyof typeof COLUNAS_USADAS, number>;
      for (const [chave, rotulo] of Object.entries(COLUNAS_USADAS) as [keyof typeof COLUNAS_USADAS, string][]) {
        const i = cab.indexOf(rotulo);
        if (i < 0 && COLUNAS_OBRIGATORIAS.includes(chave)) throw new Error(`Microdado sem a coluna "${rotulo}"; o layout mudou?`);
        idx[chave] = i;
      }
      this.colunaRegistros = cab.indexOf("Número de registros");
      this.indices = idx;
      return false;
    }
    const i = this.indices;
    const t = (k: keyof typeof COLUNAS_USADAS) => (i[k] < 0 ? "" : (c[i[k]] ?? "").trim());
    const peso = this.colunaRegistros >= 0 ? Number((c[this.colunaRegistros] ?? "1").trim()) || 1 : 1;
    this.linhas += peso;
    const ciclo = t("ciclo");
    const ano = Number(t("ano"));
    if (!ciclo || !Number.isInteger(ano)) {
      this.linhasSemCiclo++;
      return false;
    }
    // O mesmo código de ciclo pode aparecer em mais de uma unidade; a chave inclui a unidade.
    const chave = `${ano}|${ciclo}|${t("codUnidade")}`;
    let r = this.ciclos.get(chave);
    if (!r) {
      r = {
        ano,
        ciclo,
        coInst: t("coInst"),
        codUnidade: t("codUnidade"),
        codUnidadeSistec: t("codUnidadeSistec"),
        instituicao: t("instituicao"),
        unidadeEnsino: t("unidade"),
        uf: t("uf"),
        codMunicipio: t("codMunicipio"),
        cursoEmec: t("cursoEmec"),
        nomeCurso: t("nomeCurso"),
        tipoCurso: t("tipoCurso"),
        tipoOferta: t("tipoOferta"),
        modalidade: t("modalidade"),
        fonteFinanciamento: t("fonte"),
        programa: t("programa"),
        eixo: t("eixo"),
        subeixo: t("subeixo"),
        turno: t("turno"),
        formacaoProfessores: t("formacao").toLowerCase() === "sim",
        cargaHoraria: numeroOuNulo(t("ch")),
        cargaHorariaMinima: numeroOuNulo(t("chMin")),
        fatorEsforco: numeroOuNulo(t("fec")),
        inicio: dataBrParaIso(t("inicio")),
        fimPrevisto: dataBrParaIso(t("fim")),
        vagas: numeroOuNulo(t("vagas")),
        inscritos: numeroOuNulo(t("inscritos")),
        matriculas: 0,
        atendidas: 0,
        porSituacao: {},
        porRenda: {},
      };
      this.ciclos.set(chave, r);
    }
    r.matriculas += peso;
    // Layouts sem a coluna "Matrícula Atendida" (os mais antigos) só trazem matrículas atendidas.
    if (i.atendida < 0 || t("atendida").toLowerCase() === "sim") r.atendidas += peso;
    const sit = `${t("categoria")} | ${t("situacao")}`;
    r.porSituacao[sit] = (r.porSituacao[sit] ?? 0) + peso;
    const renda = t("renda") || "Não declarada";
    r.porRenda[renda] = (r.porRenda[renda] ?? 0) + peso;
    // Vagas e inscritos vêm repetidos em toda matrícula do ciclo; mantém o maior caso divirjam.
    const v = numeroOuNulo(t("vagas"));
    if (v !== null && (r.vagas === null || v > r.vagas)) r.vagas = v;
    const n = numeroOuNulo(t("inscritos"));
    if (n !== null && (r.inscritos === null || n > r.inscritos)) r.inscritos = n;
    return true;
  }
}
