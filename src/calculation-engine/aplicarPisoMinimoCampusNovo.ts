import { ANO_MINIMO_CAMPUS_NOVO } from "./constants/blocos.constants";
import type { FuncionamentoResult } from "./blocoFuncionamento";

export interface PisoMinimoCampusNovoResult extends FuncionamentoResult {
  pisoAplicado: boolean;
  valorAntesDoPiso: number;
}

/**
 * Aplica o piso mínimo do Bloco Funcionamento a câmpus criados a partir de
 * ANO_MINIMO_CAMPUS_NOVO: MAX(pisoMinimoReais, valorCalculado). `pisoMinimoReais`
 * já vem com o IPCA do ano aplicado externamente (OrcamentoAnual.pisoMinimoCampusNovo)
 * — este módulo não calcula IPCA. Um piso de 0 desativa a regra.
 */
export function aplicarPisoMinimoCampusNovo(
  resultados: FuncionamentoResult[],
  anoCriacaoPorCampus: Map<number, number | null>,
  pisoMinimoReais: number,
): PisoMinimoCampusNovoResult[] {
  return resultados.map((resultado) => {
    const anoCriacao = anoCriacaoPorCampus.get(resultado.campusId) ?? null;
    const elegivel = anoCriacao !== null && anoCriacao >= ANO_MINIMO_CAMPUS_NOVO;
    const pisoAplicado = elegivel && pisoMinimoReais > resultado.valorReais;

    return {
      ...resultado,
      valorReais: pisoAplicado ? pisoMinimoReais : resultado.valorReais,
      pisoAplicado,
      valorAntesDoPiso: resultado.valorReais,
    };
  });
}
