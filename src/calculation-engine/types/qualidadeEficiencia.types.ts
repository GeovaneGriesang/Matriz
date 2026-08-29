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

/**
 * Duas fontes oficiais documentam faixas/pesos de IEA diferentes (ver
 * qualidadeEficiencia.constants.ts) — o sistema mantém as duas disponíveis (nunca escolhe uma e
 * descarta a outra) e deixa o usuário escolher qual usar em cada cálculo:
 * - "PLANILHA_2026" (padrão): faixas da planilha-modelo oficial do ciclo orçamentário de 2026.
 * - "FORPLAN_2025": faixas do livro "A Matriz Orçamentária da Rede Federal de EPCT" (CONIF/Forplan, 2025).
 */
export type EstrategiaFaixasIea = "PLANILHA_2026" | "PLANILHA_2027" | "FORPLAN_2025";

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
  /** Qual tabela de faixas/pesos foi usada para enquadrar `valorIea` — sempre exposto na memória de cálculo. */
  estrategia: EstrategiaFaixasIea;
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
// IEA, ver acima). A Portaria SETEC/MEC nº 51/2018, Art. 5º, define oficialmente
// RAP Presencial = Matrícula-equivalente presencial ÷ Professor Equivalente.
//
// APROXIMAÇÃO: RAP Presencial calculado com matrícula bruta presencial (TaxaEvasao.csv,
// medida "Número de Matrículas" filtrada por ModalidadeEnsino = "Educação Presencial"), não com
// Matrícula-equivalente presencial oficial (Portaria 51/2018, que pondera por Fator de Esforço de
// Curso — seção 3.2.1 da metodologia, deixado para um próximo passo). Erro esperado entre +0,9% e
// +53% dependendo da instituição, testado em golden_values_indicadores.csv. Ver seção 9 de
// Metodologia_Matriz_Orcamentaria_CONIF.md. O denominador (Professor Equivalente, de
// `RelacaoAlunoProfessorRAP.csv`) já está correto e não precisa de ajuste.
//
// Os dois insumos (matrículas presenciais e professor equivalente) são somados por instituição
// e SÓ ENTÃO divididos — nunca ler o "RAP | RAP" já pronto por câmpus e combinar razões já
// calculadas (não é equivalente).

export type RapBand = "MUITO_BAIXA" | "BAIXA" | "MEDIA" | "ALTA" | "MUITO_ALTA";

/** Matrículas presenciais (aproximação do numerador oficial) e Professor Equivalente de um câmpus, insumo bruto (nunca já dividido). */
export interface RapInput {
  campusId: number;
  instituicaoId: number;
  matriculasPresenciais: number;
  professorEquivalente: number;
}

/** Contribuição bruta de um câmpus à soma da instituição — só para memória de cálculo. */
export interface RapCampusContribuicao {
  campusId: number;
  matriculasPresenciais: number;
  professorEquivalente: number;
}

export interface RapInstituicaoResult {
  instituicaoId: number;
  porCampus: RapCampusContribuicao[];
  /** Somas das contagens absolutas de todos os câmpus da instituição. */
  matriculasPresenciais: number;
  professorEquivalente: number;
  /**
   * RAP Presencial (aproximado) = matriculasPresenciais ÷ professorEquivalente, calculado uma
   * única vez por instituição. Ver nota de APROXIMAÇÃO acima.
   */
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
