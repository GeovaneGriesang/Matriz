// ---------- IEA (Índice de Eficiência Acadêmica) ----------

export type IeaBand = "MUITO_BAIXO" | "BAIXO" | "MEDIO" | "ALTO" | "MUITO_ALTO";

export interface IeaInput {
  campusId: number;
  valorIea: number;
}

export interface IeaDistribuicaoResult {
  campusId: number;
  band: IeaBand;
  peso: number;
  share: number;
  valorReais: number;
}

// ---------- RAP (Relação Aluno-Professor) ----------
//
// A razão docente/aluno já vem calculada pela PNP (medida "RAP | RAP" do
// arquivo RelacaoAlunoProfessorRAP.csv) — não há dado de docentes por regime
// de trabalho nos exports reais, então não reimplementamos esse cálculo.

export type RapBand = "MUITO_BAIXA" | "BAIXA" | "MEDIA" | "ALTA" | "MUITO_ALTA";

export interface RapInput {
  campusId: number;
  razaoDocenteAluno: number;
}

export interface RapDistribuicaoResult {
  campusId: number;
  razaoDocenteAluno: number;
  band: RapBand;
  peso: number;
  share: number;
  valorReais: number;
}

// ---------- IAPL (Percentuais Legais) ----------

export interface IaplCampusInput {
  campusId: number;
  matriculasTecnicos: number;
  matriculasFormacaoProfessores: number;
  matriculasProeja: number;
}

export interface IaplDistribuicaoResult {
  campusId: number;
  valorTecnicos: number;
  valorFormacaoProfessores: number;
  valorProeja: number;
  valorTotal: number;
}
