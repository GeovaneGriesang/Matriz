import { IAPL_SPLIT } from "../../constants/qualidadeEficiencia.constants";

export interface IaplLegalSplitResult {
  tecnicos: number;
  formacaoProfessores: number;
  proeja: number;
}

/** Divide o sub-bloco IAPL nas três metas legais (Técnicos 70% / Formação de Professores 20% / PROEJA 10%). */
export function splitLegal(totalIapl: number): IaplLegalSplitResult {
  return {
    tecnicos: totalIapl * IAPL_SPLIT.CURSOS_TECNICOS,
    formacaoProfessores: totalIapl * IAPL_SPLIT.FORMACAO_PROFESSORES,
    proeja: totalIapl * IAPL_SPLIT.PROEJA,
  };
}
