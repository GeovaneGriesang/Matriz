// ---------- IEA (Índice de Eficiência Acadêmica) ----------
//
// A planilha oficial da Matriz CONIF só apura IEA/RAP/IAPL em nível de
// INSTITUIÇÃO (nas linhas de câmpus essas colunas ficam em branco) — por isso
// os resultados destes sub-blocos são agregados por instituicaoId, não por
// campusId (mesmo padrão já usado pelo Bloco Reitorias). O enquadramento em
// faixa/peso continua por câmpus (é o dado bruto disponível), mas a soma
// ponderada usada para calcular a participação de rede é por instituição.

export type IeaBand = "MUITO_BAIXO" | "BAIXO" | "MEDIO" | "ALTO" | "MUITO_ALTO";

export interface IeaInput {
  campusId: number;
  instituicaoId: number;
  valorIea: number;
}

export interface IeaCampusPonderado {
  campusId: number;
  valorIea: number;
  band: IeaBand;
  peso: number;
  /** IEA Ponderado = valorIea × peso (Figura 7 do livro da Matriz). */
  ponderado: number;
}

export interface IeaInstituicaoResult {
  instituicaoId: number;
  porCampus: IeaCampusPonderado[];
  /** Soma do IEA Ponderado de todos os câmpus da instituição. */
  ponderadoInstituicao: number;
  somaPonderadosRede: number;
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
  instituicaoId: number;
  razaoDocenteAluno: number;
}

export interface RapCampusPonderado {
  campusId: number;
  razaoDocenteAluno: number;
  band: RapBand;
  peso: number;
  /** RAP Ponderado = razaoDocenteAluno × peso (Figura 9 do livro da Matriz). */
  ponderado: number;
}

export interface RapInstituicaoResult {
  instituicaoId: number;
  porCampus: RapCampusPonderado[];
  /** Soma do RAP Ponderado de todos os câmpus da instituição. */
  ponderadoInstituicao: number;
  somaPonderadosRede: number;
  share: number;
  valorReais: number;
}

// ---------- IAPL (Percentuais Legais) ----------

export interface IaplCampusInput {
  campusId: number;
  instituicaoId: number;
  matriculasTecnicos: number;
  matriculasFormacaoProfessores: number;
  matriculasProeja: number;
}

export interface IaplInstituicaoResult {
  instituicaoId: number;
  matriculasTecnicos: number;
  matriculasFormacaoProfessores: number;
  matriculasProeja: number;
  valorTecnicos: number;
  valorFormacaoProfessores: number;
  valorProeja: number;
  valorTotal: number;
}
