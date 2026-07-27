import { NotImplementedError } from "./errors/NotImplementedError";

export interface MatriculaTotalEqualizadaRegistro {
  matriculaTotalPresencialEqualizada: number;
  matriculaTotalEadEqualizada: number;
  matriculaTotalEadMoocEqualizada: number;
  matriculaTotalEadFpEqualizada: number;
}

/**
 * Soma os 4 componentes da Matrícula Total equalizada oficial (colunas Q/R/S/T de "COMPLETO
 * PROPOSTA" na planilha da CONIF) de um câmpus/ano-base — valor publicado pela CONIF e cadastrado
 * em `MatriculaTotalEqualizadaAnual` (tela /admin/dados-anuais), nunca recalculado aqui.
 *
 * Recebe o registro já resolvido pelo chamador — `runCalculation.ts` busca por (unidadeId, ano-base)
 * e decide o fallback quando não existe. Mantém este arquivo livre de acesso a banco, como todo o
 * resto de `calculation-engine/` (`blocoFuncionamento.ts`, `calcularBlocoRap.ts` etc. também só
 * recebem fatos já resolvidos, nunca consultam o Prisma diretamente).
 *
 * `registro === undefined` significa que não existe Matrícula Total equalizada oficial para este
 * câmpus/ano-base (câmpus novo, ou ano ainda não importado) — lança em vez de inventar um valor;
 * quem chama decide o fallback (Bloco Funcionamento/Reitorias em runCalculation.ts caem de volta em
 * "Matrícula Equivalente | Geral" da PNP como placeholder nesse caso, com aviso na memória de cálculo).
 */
export function calcularMatriculaTotalEqualizada(registro: MatriculaTotalEqualizadaRegistro | undefined): number {
  if (registro === undefined) {
    throw new NotImplementedError(
      "Matrícula Total equalizada oficial não cadastrada para este câmpus/ano-base — importe em /admin/dados-anuais ou trate o fallback no chamador.",
    );
  }
  return (
    registro.matriculaTotalPresencialEqualizada +
    registro.matriculaTotalEadEqualizada +
    registro.matriculaTotalEadMoocEqualizada +
    registro.matriculaTotalEadFpEqualizada
  );
}
