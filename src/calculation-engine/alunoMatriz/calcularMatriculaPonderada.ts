import type { MatriculaPonderadaInput, MatriculaPonderadaResult } from "../types/alunoMatriz.types";
import { modalidadeWeight } from "./modalidadeWeight";
import { eixoAgricolaBonus } from "./eixoAgricolaBonus";
import { labInfraWeight } from "./labInfraWeight";
import { tecnicoIntegradoMinimo } from "./tecnicoIntegradoMinimo";
import { retencaoJanela, pesoRetencao } from "./retencaoJanela";
import { isStrictoSensu, strictoSensuFactor } from "./strictoSensuFactor";

/**
 * Converte a Matrícula Equivalente (Mateq) em Matrícula Ponderada (MT_pond).
 *
 * Para cursos Stricto Sensu, o fator 3.75 SUBSTITUI os demais pesos (modalidade,
 * laboratório, eixo agrícola) — decisão confirmada com o usuário, já que esses
 * fatores não se aplicam a cursos de pós-graduação stricto sensu.
 * Para os demais níveis, os pesos são compostos em cadeia: Mateq × modalidade ×
 * labInfra × bônus agrícola, com o piso de Técnico Integrado aplicado em seguida
 * e a ponderação por retenção aplicada por último.
 */
export function calcularMatriculaPonderada(
  input: MatriculaPonderadaInput,
): MatriculaPonderadaResult {
  const janela = retencaoJanela(input.dataIngressoCiclo, input.dataReferencia);
  const fatorRetencao = pesoRetencao(janela.dentroDaJanela);

  if (isStrictoSensu(input.nivel)) {
    return {
      matriculaPonderada: input.matriculaEquivalente * strictoSensuFactor(input.nivel) * fatorRetencao,
      strictoSensuAplicado: true,
      dentroDaJanelaRetencao: janela.dentroDaJanela,
    };
  }

  const pesoModalidade = modalidadeWeight(input.modalidade);
  const pesoLab = labInfraWeight(input.labInfraTier);
  const pesoComEixo = eixoAgricolaBonus(input.eixoAgricola, pesoModalidade * pesoLab);
  const pesoComPiso = tecnicoIntegradoMinimo(input.nivel, pesoComEixo);

  return {
    matriculaPonderada: input.matriculaEquivalente * pesoComPiso * fatorRetencao,
    strictoSensuAplicado: false,
    dentroDaJanelaRetencao: janela.dentroDaJanela,
  };
}
