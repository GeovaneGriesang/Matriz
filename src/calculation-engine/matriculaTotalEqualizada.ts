import { NotImplementedError } from "./errors/NotImplementedError";

export interface MatriculaTotalEqualizadaRegistro {
  matriculaTotalPresencialEqualizada: number;
  matriculaTotalEadEqualizada: number;
  matriculaTotalEadMoocEqualizada: number;
  matriculaTotalEadFpEqualizada: number;
}

/**
 * Pesos que convertem as 4 colunas de Matrícula Total equalizada em R$ nos Blocos
 * Funcionamento/Reitorias.
 *
 * **Estes pesos mudam entre ciclos orçamentários** — o EAD MOOC valia 0,8 em 2026 e passou a valer
 * 0,08 em 2027 (dez vezes menos), conforme a planilha "Composição de Repasse" da CONIF. Por isso o
 * cálculo não usa mais constantes fixas: os pesos vigentes de cada ano ficam em
 * `ComposicaoRepasseAnual` (cadastrados em /admin/composicao-repasse) e chegam aqui por parâmetro.
 */
export interface PesosModalidade {
  presencial: number;
  ead: number;
  eadMooc: number;
  eadFp: number;
}

/**
 * Pesos do ciclo 2026, confirmados célula a célula contra "COMPLETO PROPOSTA" da planilha-modelo
 * (taxa idêntica em toda a rede, R$/ponto Presencial ÷ 4 = R$/ponto EAD, R$/ponto Presencial × 0,8 =
 * R$/ponto EAD MOOC = R$/ponto EAD FP).
 *
 * Usados como fallback quando o ano calculado ainda não tem Composição de Repasse cadastrada. O
 * fallback é sinalizado na memória de cálculo — para um ciclo novo, cadastrar os pesos daquele ano é
 * obrigatório, porque aplicar os de 2026 a 2027 daria EAD MOOC dez vezes maior que o correto.
 */
export const PESOS_MODALIDADE_2026: PesosModalidade = {
  presencial: 1,
  ead: 0.25,
  eadMooc: 0.8,
  eadFp: 0.8,
};

export interface MatriculaTotalEqualizadaPonderada {
  /**
   * Presencial×1 + EAD×0,25 + EAD FP×0,8 — participa do denominador que define a Taxa (MTP, R$ por
   * ponto ponderado) do Bloco Funcionamento. EAD MOOC fica de fora deste denominador de propósito
   * (ver `moocAdicionalFuncionamento`) — confirmado contra a planilha: incluir EAD MOOC aqui reduz
   * a MTP de todos os câmpus (dilui), o que a planilha não faz.
   */
  denominadorFuncionamento: number;
  /**
   * EAD MOOC×0,8 — pago à MESMA Taxa (MTP) do Bloco Funcionamento, mas somado DEPOIS de calcular a
   * MTP a partir do denominador acima (sem EAD MOOC): dinheiro adicional para o câmpus que oferece
   * EAD MOOC, sem diluir a taxa dos demais câmpus da rede.
   */
  moocAdicionalFuncionamento: number;
  /**
   * `denominadorFuncionamento + moocAdicionalFuncionamento` — base usada pelo Bloco Reitorias
   * (blocoReitorias.ts), agregada por instituição. Diferente do Bloco Funcionamento, aqui o EAD
   * MOOC entra normalmente (peso 0,8, mesmo tratamento de EAD FP) — confirmado contra a planilha
   * (IFRS: reitoria oficial bate exatamente usando esta soma, não bate usando só o denominador).
   */
  pesoReitorias: number;
}

/**
 * Aplica os pesos oficiais por modalidade (ver `PESO_MTE_*` acima) à Matrícula Total equalizada
 * oficial (colunas Q/R/S/T de "COMPLETO PROPOSTA" na planilha da CONIF) de um câmpus/ano-base —
 * valor publicado pela CONIF e cadastrado em `MatriculaTotalEqualizadaAnual` (tela
 * /admin/dados-anuais), nunca recalculado aqui.
 *
 * Recebe o registro já resolvido pelo chamador — `runCalculation.ts` busca por (unidadeId, ano-base)
 * e decide o fallback quando não existe. Mantém este arquivo livre de acesso a banco, como todo o
 * resto de `calculation-engine/` (`blocoFuncionamento.ts`, `calcularBlocoRap.ts` etc. também só
 * recebem fatos já resolvidos, nunca consultam o Prisma diretamente).
 *
 * `registro === undefined` significa que não existe Matrícula Total equalizada oficial para este
 * câmpus/ano-base (câmpus novo, ou ano ainda não importado) — lança em vez de inventar um valor;
 * quem chama decide o fallback (Bloco Funcionamento/Reitorias em runCalculation.ts caem de volta em
 * "Matrícula Equivalente | Geral" da PNP como placeholder nesse caso, com aviso na memória de cálculo
 * — sem quebra de modalidade disponível, tratado como já-blendado: vai inteiro no denominador, sem
 * adicional de MOOC).
 */
export function calcularMatriculaTotalEqualizadaPonderada(
  registro: MatriculaTotalEqualizadaRegistro | undefined,
  pesos: PesosModalidade = PESOS_MODALIDADE_2026,
): MatriculaTotalEqualizadaPonderada {
  if (registro === undefined) {
    throw new NotImplementedError(
      "Matrícula Total equalizada oficial não cadastrada para este câmpus/ano-base — importe em /admin/dados-anuais ou trate o fallback no chamador.",
    );
  }
  const denominadorFuncionamento =
    registro.matriculaTotalPresencialEqualizada * pesos.presencial +
    registro.matriculaTotalEadEqualizada * pesos.ead +
    registro.matriculaTotalEadFpEqualizada * pesos.eadFp;
  const moocAdicionalFuncionamento = registro.matriculaTotalEadMoocEqualizada * pesos.eadMooc;
  return {
    denominadorFuncionamento,
    moocAdicionalFuncionamento,
    pesoReitorias: denominadorFuncionamento + moocAdicionalFuncionamento,
  };
}
