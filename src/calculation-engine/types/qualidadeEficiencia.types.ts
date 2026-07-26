// ---------- IEA (Índice de Eficiência Acadêmica) ----------
//
// A planilha oficial da Matriz CONIF só apura IEA/RAP/IAPL em nível de
// INSTITUIÇÃO (nas linhas de câmpus essas colunas ficam em branco). A
// metodologia oficial (Guia de Referência da PNP, seção 3.1 de
// docs/pnp-matriz/Metodologia_Matriz_Orcamentaria_CONIF.md) exige somar as
// contagens absolutas (Concluídos/Evadidos/Retidos) de todos os câmpus da
// instituição PRIMEIRO, calcular o IEA uma única vez sobre essa soma, e só
// então enquadrar esse valor único em faixa/peso — nunca enquadrar por
// câmpus e combinar valores já ponderados (isso não é equivalente, a fórmula
// não é linear).

export type IeaBand = "MUITO_BAIXO" | "BAIXO" | "MEDIO" | "ALTO" | "MUITO_ALTO";

/** Contagens absolutas de um câmpus, insumo bruto (nunca já enquadrado em faixa). */
export interface IeaInput {
  campusId: number;
  instituicaoId: number;
  concluidos: number;
  evadidos: number;
  retidos: number;
}

/** Contribuição bruta de um câmpus à soma da instituição — só para memória de cálculo. */
export interface IeaCampusContribuicao {
  campusId: number;
  concluidos: number;
  evadidos: number;
  retidos: number;
}

export interface IeaInstituicaoResult {
  instituicaoId: number;
  porCampus: IeaCampusContribuicao[];
  /** Somas das contagens absolutas de todos os câmpus da instituição. */
  concluidos: number;
  evadidos: number;
  retidos: number;
  /** C_ciclo/Ev_ciclo/R_ciclo institucionais (proporção sobre concluidos+evadidos+retidos). */
  cCiclo: number;
  evCiclo: number;
  rCiclo: number;
  /** IEA = C_ciclo + R_ciclo × (C_ciclo / (C_ciclo + Ev_ciclo)), calculado uma única vez por instituição. */
  valorIea: number;
  band: IeaBand;
  peso: number;
  /** IEA Ponderado = valorIea × peso (Figura 7 do livro da Matriz). */
  ponderado: number;
  somaPonderadosRede: number;
  share: number;
  valorReais: number;
}

// ---------- RAP (Relação Aluno-Professor) ----------
//
// RAP só é apurado em nível de INSTITUIÇÃO na Matriz CONIF (mesmo caso do
// IEA, ver acima). A Portaria SETEC/MEC nº 51/2018, Art. 5º, define
// RAP = Matrículas RAP ÷ Professor Equivalente — não há dado de docentes por
// regime de trabalho nos exports reais para recalcular esses dois valores,
// então eles são lidos prontos por câmpus de `RelacaoAlunoProfessorRAP.csv`
// (medidas "RAP | Matrículas RAP" e "RAP | Professor Equivalente"), somados
// por instituição, e SÓ ENTÃO divididos — nunca ler o "RAP | RAP" já pronto
// por câmpus e combinar razões já calculadas (não é equivalente).

export type RapBand = "MUITO_BAIXA" | "BAIXA" | "MEDIA" | "ALTA" | "MUITO_ALTA";

/** Matrículas RAP e Professor Equivalente de um câmpus, insumo bruto (nunca já dividido). */
export interface RapInput {
  campusId: number;
  instituicaoId: number;
  matriculasRap: number;
  professorEquivalente: number;
}

/** Contribuição bruta de um câmpus à soma da instituição — só para memória de cálculo. */
export interface RapCampusContribuicao {
  campusId: number;
  matriculasRap: number;
  professorEquivalente: number;
}

export interface RapInstituicaoResult {
  instituicaoId: number;
  porCampus: RapCampusContribuicao[];
  /** Somas das contagens absolutas de todos os câmpus da instituição. */
  matriculasRap: number;
  professorEquivalente: number;
  /** RAP = Matrículas RAP ÷ Professor Equivalente, calculado uma única vez por instituição. */
  razaoDocenteAluno: number;
  band: RapBand;
  peso: number;
  /** RAP Ponderado = razaoDocenteAluno × peso (Figura 9 do livro da Matriz). */
  ponderado: number;
  somaPonderadosRede: number;
  share: number;
  valorReais: number;
}

// ---------- IAPL (Atendimento a Percentuais Legais) ----------
//
// Cada categoria (Técnicos/Formação de Professores/Proeja) tem seu próprio %ME institucional
// (Matrícula Equivalente da categoria ÷ Matrícula Equivalente Geral) enquadrado numa tabela de
// faixas/pesos própria (seção 2.1 da metodologia) ANTES de distribuir — nunca distribuir
// proporcionalmente à matrícula bruta da categoria, isso não recompensa quem atinge o piso legal.

export interface IaplCampusInput {
  campusId: number;
  instituicaoId: number;
  matriculasTecnicos: number;
  matriculasFormacaoProfessores: number;
  matriculasProeja: number;
  /** Matrícula Equivalente | Geral do câmpus (denominador do %ME de cada categoria). */
  matriculasGeral: number;
}

/** Resultado do enquadramento de uma categoria (Técnicos/Formação de Professores/Proeja) por instituição. */
export interface IaplCategoriaResult {
  matriculas: number;
  matriculasGeral: number;
  /** %ME = matriculas ÷ matriculasGeral. */
  percentualMe: number;
  peso: number;
  /** Ponderado = %ME × peso — usado para ratear o valor da categoria entre instituições. */
  ponderado: number;
  somaPonderadosRede: number;
  share: number;
  valorReais: number;
}

export interface IaplInstituicaoResult {
  instituicaoId: number;
  tecnicos: IaplCategoriaResult;
  formacaoProfessores: IaplCategoriaResult;
  proeja: IaplCategoriaResult;
  valorTotal: number;
}
