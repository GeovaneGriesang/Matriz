/**
 * Por que o Funcionamento de um câmpus mudou entre dois ciclos: decompõe a diferença
 * do valor da MATRIZ (não do informado, que é digitado e não tem "porquê").
 *
 * O Funcionamento de um câmpus é, por modalidade, matrícula total × valor de uma
 * matrícula, somado, e depois o Piso Mínimo pode elevá-lo. Logo a diferença entre dois
 * ciclos se separa, sem resto, em quatro efeitos:
 *
 *   matrícula      mais ou menos alunos ponderados, ao valor de matrícula do ciclo A;
 *   orçamento      o Funcionamento da rede cresceu ou encolheu, mudando o valor de cada
 *                  matrícula, com a matrícula da rede como estava no ciclo B;
 *   matrícula da rede
 *                  a rede toda ganhou ou perdeu matrícula, dividindo o mesmo dinheiro
 *                  entre mais ou menos alunos (o "efeito diluição");
 *   piso           o câmpus passou a (ou deixou de) ser elevado ao Piso Mínimo.
 *
 * A soma dos quatro é exatamente a diferença entre os dois valores de matriz.
 */

export type Modalidade = "presencial" | "ead" | "eadMooc" | "eadFp";

export const ROTULO_MODALIDADE: Record<Modalidade, string> = {
  presencial: "Presencial",
  ead: "EAD",
  eadMooc: "EAD MOOC",
  eadFp: "EAD com financiamento próprio",
};

export interface CicloParaExplicar {
  ano: number;
  /** Matrícula Total do câmpus por modalidade. */
  mt: Record<Modalidade, number>;
  /** Valor em reais de uma matrícula em cada modalidade. */
  valorMatricula: Record<Modalidade, number>;
  /** Funcionamento final publicado (já com o Piso Mínimo). */
  final: number;
  /** Funcionamento distribuído por matrícula na rede (total menos a reserva do piso). */
  fundoRede: number;
}

export interface ExplicacaoVariacao {
  anoA: number;
  anoB: number;
  valorA: number;
  valorB: number;
  diferenca: number;
  efeitoMatricula: number;
  efeitoMatriculaPorModalidade: { modalidade: Modalidade; rotulo: string; matriculaA: number; matriculaB: number; efeito: number }[];
  efeitoOrcamento: number;
  efeitoMatriculaRede: number;
  efeitoPiso: number;
  /** Variação percentual do valor de uma matrícula presencial e da matrícula total da rede. */
  valorMatriculaPresencialA: number;
  valorMatriculaPresencialB: number;
  matriculaRedeA: number;
  matriculaRedeB: number;
  fundoRedeA: number;
  fundoRedeB: number;
  /** Conferência: soma dos efeitos menos a diferença. Deve ser zero. */
  resto: number;
}

const MODALIDADES: Modalidade[] = ["presencial", "ead", "eadMooc", "eadFp"];

function calculado(c: CicloParaExplicar): number {
  return MODALIDADES.reduce((s, m) => s + c.mt[m] * c.valorMatricula[m], 0);
}

/** `null` quando um dos ciclos não tem o valor de matrícula (não dá para separar os efeitos). */
export function explicarVariacao(a: CicloParaExplicar, b: CicloParaExplicar): ExplicacaoVariacao | null {
  const vA = a.valorMatricula.presencial;
  const vB = b.valorMatricula.presencial;
  if (!(vA > 0) || !(vB > 0)) return null;

  const porModalidade = MODALIDADES.map((m) => ({
    modalidade: m,
    rotulo: ROTULO_MODALIDADE[m],
    matriculaA: a.mt[m],
    matriculaB: b.mt[m],
    efeito: (b.mt[m] - a.mt[m]) * a.valorMatricula[m],
  }));
  const efeitoMatricula = porModalidade.reduce((s, m) => s + m.efeito, 0);

  // Valor de uma matrícula = fundo ÷ matrícula total da rede, em equivalentes presenciais.
  const matriculaRedeA = a.fundoRede / vA;
  const matriculaRedeB = b.fundoRede / vB;
  // Mudança do valor de uma matrícula (presencial) separada em orçamento e rede:
  //   vB - vA = (FB - FA) / MB  +  FA * (1/MB - 1/MA)
  const parteOrcamento = (b.fundoRede - a.fundoRede) / matriculaRedeB;
  const parteRede = a.fundoRede * (1 / matriculaRedeB - 1 / matriculaRedeA);
  // Cada modalidade escala com o mesmo fator do presencial (o peso é constante), então o
  // efeito total do valor é a matrícula ponderada de B × (vB - vA) e se reparte nas duas partes.
  const matriculaPonderadaB = MODALIDADES.reduce((s, m) => s + b.mt[m] * (a.valorMatricula[m] / vA), 0);
  const efeitoOrcamento = matriculaPonderadaB * parteOrcamento;
  const efeitoMatriculaRede = matriculaPonderadaB * parteRede;

  const calcA = calculado(a);
  const calcB = calculado(b);
  const efeitoPiso = b.final - calcB - (a.final - calcA);

  const diferenca = b.final - a.final;
  const soma = efeitoMatricula + efeitoOrcamento + efeitoMatriculaRede + efeitoPiso;
  return {
    anoA: a.ano,
    anoB: b.ano,
    valorA: a.final,
    valorB: b.final,
    diferenca,
    efeitoMatricula,
    efeitoMatriculaPorModalidade: porModalidade,
    efeitoOrcamento,
    efeitoMatriculaRede,
    efeitoPiso,
    valorMatriculaPresencialA: vA,
    valorMatriculaPresencialB: vB,
    matriculaRedeA,
    matriculaRedeB,
    fundoRedeA: a.fundoRede,
    fundoRedeB: b.fundoRede,
    resto: soma - diferenca,
  };
}
