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
 * Os pesos vigentes de cada ciclo ficam em `ComposicaoRepasseAnual` (cadastrados em
 * /admin/composicao-repasse a partir da planilha "Composição de Repasse" da CONIF) e chegam aqui por
 * parâmetro — a CONIF republica essa tabela a cada ciclo, então o cálculo não deve depender de
 * constante fixa no código.
 */
export interface PesosModalidade {
  presencial: number;
  ead: number;
  eadMooc: number;
  eadFp: number;
}

/**
 * Pesos padrão da CONIF, usados quando o ano calculado ainda não tem Composição de Repasse
 * cadastrada. Conferidos em 2026-08-28 contra `DADOS BASE!K29/K33/K37/K41` das planilhas oficiais de
 * **2026 e 2027** (idênticos nos dois ciclos) e contra as planilhas "Composição de Repasse" dos dois
 * anos.
 *
 * ATENÇÃO ao EAD MOOC: é **0,08**, não 0,8. Até 2026-08-28 esta constante estava em 0,8 — valor que
 * vinha da seção "X = S_campus * (MTP * 0,8)" da metodologia, onde já constava a ressalva "[ver
 * nuance MOOC na planilha original]". A ressalva estava certa e o valor errado: as quatro fontes
 * oficiais disponíveis (planilha 2026, planilha 2027, composição 2026, composição 2027) trazem 0,08,
 * e na planilha 2027 a conta fecha exatamente (IFSUL: 2.338,3 pontos de MOOC × R$ 96,12 = R$
 * 224.751,38, com R$ 96,12 = MTP 1.201,47 × 0,08). O 0,8 é o peso do EAD FP, provavelmente copiado
 * por engano. O erro inflava em ~1,15% o Bloco Funcionamento dos 60 câmpus com MOOC no ciclo 2026.
 */
export const PESOS_MODALIDADE_PADRAO: PesosModalidade = {
  presencial: 1,
  ead: 0.25,
  eadMooc: 0.08,
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
   * EAD MOOC × seu peso (0,08 nos ciclos 2026 e 2027) — pago à MESMA Taxa (MTP) do Bloco
   * Funcionamento, mas somado DEPOIS de calcular a MTP a partir do denominador acima (sem EAD MOOC):
   * dinheiro adicional para o câmpus que oferece EAD MOOC, sem diluir a taxa dos demais câmpus.
   */
  moocAdicionalFuncionamento: number;
  /**
   * `denominadorFuncionamento + moocAdicionalFuncionamento` — base usada pelo Bloco Reitorias
   * (blocoReitorias.ts), agregada por instituição. Diferente do Bloco Funcionamento, aqui o EAD
   * MOOC entra no total normalmente — confirmado contra a planilha (IFRS: reitoria oficial bate
   * exatamente usando esta soma, não bate usando só o denominador).
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
  pesos: PesosModalidade = PESOS_MODALIDADE_PADRAO,
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
