import { describe, expect, it } from "vitest";
import { anoDaVirada, simularOpcaoCurso, type OpcaoCurso, type ParametrosSimulacaoCurso } from "@/lib/mdo/simulacaoCurso";

const parametros: ParametrosSimulacaoCurso = {
  peso: 1.5,
  agropecuaria: false,
  valorMatricula: 1200,
  anoInicial: 2027,
  horizonteAnos: 8,
};

function opcao(sobrescreve: Partial<OpcaoCurso>): OpcaoCurso {
  return { rotulo: "curso", anosDuracao: 3, chTotalCiclo: 3200, chMatriz: 3200, vagasPorAno: 40, evasaoAnual: 0, ...sobrescreve };
}

describe("simulação de curso, 3 anos contra 4 anos", () => {
  it("com a mesma CH total, a turma rende o mesmo por ingressante", () => {
    const tres = simularOpcaoCurso(opcao({ anosDuracao: 3 }), parametros);
    const quatro = simularOpcaoCurso(opcao({ anosDuracao: 4 }), parametros);
    // 3.200 h / 800 = 4,0 por aluno; peso 1,5; R$ 1.200 por matrícula.
    expect(tres.valorPorIngressante).toBeCloseTo(4 * 1.5 * 1200, 2);
    expect(quatro.valorPorIngressante).toBeCloseTo(4 * 1.5 * 1200, 2);
  });

  it("em regime, o valor anual é igual, mas cada aluno de 3 anos vale 4/3 do de 4 anos", () => {
    const tres = simularOpcaoCurso(opcao({ anosDuracao: 3 }), parametros);
    const quatro = simularOpcaoCurso(opcao({ anosDuracao: 4 }), parametros);
    expect(tres.regime.valor).toBeCloseTo(quatro.regime.valor, 2);
    expect(tres.regime.alunosAtivos).toBe(120);
    expect(quatro.regime.alunosAtivos).toBe(160);
    expect(tres.regime.valorPorAlunoAno / quatro.regime.valorPorAlunoAno).toBeCloseTo(4 / 3, 6);
  });

  it("o curso de 3 anos chega ao regime antes e acumula mais no início", () => {
    const tres = simularOpcaoCurso(opcao({ anosDuracao: 3 }), parametros);
    const quatro = simularOpcaoCurso(opcao({ anosDuracao: 4 }), parametros);
    expect(tres.linhas[1]!.valor).toBeGreaterThan(quatro.linhas[1]!.valor);
    expect(anoDaVirada(tres, quatro)).toBe(2027);
  });

  it("CH acima do teto da matriz não rende", () => {
    const acima = simularOpcaoCurso(opcao({ anosDuracao: 4, chTotalCiclo: 3750, chMatriz: 3200 }), parametros);
    const noTeto = simularOpcaoCurso(opcao({ anosDuracao: 4, chTotalCiclo: 3200, chMatriz: 3200 }), parametros);
    expect(acima.chDesperdicada).toBe(550);
    expect(acima.valorPorIngressante).toBeCloseTo(noTeto.valorPorIngressante, 2);
  });

  it("um curso de 4 anos com CH maior rende mais, até o teto", () => {
    const tres = simularOpcaoCurso(opcao({ anosDuracao: 3, chTotalCiclo: 3000, chMatriz: 3200 }), parametros);
    const quatro = simularOpcaoCurso(opcao({ anosDuracao: 4, chTotalCiclo: 3200, chMatriz: 3200 }), parametros);
    expect(quatro.valorPorIngressante).toBeGreaterThan(tres.valorPorIngressante);
    expect(quatro.valorPorIngressante / tres.valorPorIngressante).toBeCloseTo(3200 / 3000, 6);
  });

  it("evasão reduz o que a turma rende", () => {
    const sem = simularOpcaoCurso(opcao({ evasaoAnual: 0 }), parametros);
    const com = simularOpcaoCurso(opcao({ evasaoAnual: 0.2 }), parametros);
    expect(com.regime.valor).toBeLessThan(sem.regime.valor);
    expect(com.regime.alunosAtivos).toBeCloseTo(40 * (1 + 0.8 + 0.64), 6);
  });

  it("a diluição reduz o valor da matrícula quando o curso cresce a rede", () => {
    const fixo = simularOpcaoCurso(opcao({}), parametros);
    const diluido = simularOpcaoCurso(opcao({}), { ...parametros, diluicao: { matriculasEquivalentesRede: 1000 } });
    expect(diluido.regime.valor).toBeLessThan(fixo.regime.valor);
  });

  it("o primeiro ano só conta os dias a partir do início das aulas", () => {
    const r = simularOpcaoCurso(opcao({ anosDuracao: 3 }), parametros);
    // Março a dezembro: 306 de 1.096 dias (o terceiro ano é bissexto) da turma de 3 anos.
    expect(r.linhas[0]!.matriculaTotal).toBeCloseTo(40 * 1.5 * 4 * (306 / 1096), 4);
  });
});

describe("curso novo a partir de 2028, ano a ano", () => {
  // Técnico em Eletromecânica integrado: peso efetivo 2,5, teto de CH da matriz de 3.200 h, matrícula de R$ 1.228,90 no ciclo 2027.
  const novo = opcao({ anosDuracao: 4, chTotalCiclo: 4200, chMatriz: 3200, vagasPorAno: 40 });
  const p: ParametrosSimulacaoCurso = {
    peso: 2.5,
    agropecuaria: false,
    valorMatricula: 1228.9,
    anoInicial: 2028,
    horizonteAnos: 8,
    anoDoValor: 2027,
  };

  it("a CH acima do teto não rende: 4.200 h rende o mesmo que 3.200 h", () => {
    const com4200 = simularOpcaoCurso(novo, p);
    const com3200 = simularOpcaoCurso({ ...novo, chTotalCiclo: 3200 }, p);
    expect(com4200.chDesperdicada).toBe(1000);
    expect(com4200.valorAcumuladoHorizonte).toBeCloseTo(com3200.valorAcumuladoHorizonte, 2);
  });

  it("a primeira turma entra em 2028 e o curso chega ao regime com 4 turmas em 2031", () => {
    const r = simularOpcaoCurso(novo, p);
    expect(r.linhas[0]!.ano).toBe(2028);
    // Em 2032 aparece uma quinta turma: a de 2028 só termina em fevereiro de 2032 e ainda conta nesses meses.
    expect(r.linhas.map((l) => l.turmasAtivas).slice(0, 5)).toEqual([1, 2, 3, 4, 5]);
    // Um aluno rende, por ano, peso x (CH efetiva ÷ 800) ÷ anos x valor = 2,5 x 4 ÷ 4 x R$ 1.228,90 = R$ 3.072,25; 160 alunos, R$ 491.560.
    // A turma que entra em março conta só dez meses no primeiro ano, então o regime fica um pouco abaixo disso.
    const regime = r.linhas.find((l) => l.ano === 2031)!;
    expect(regime.alunosAtivos).toBe(160);
    expect(regime.valor).toBeLessThanOrEqual(160 * 3072.25 + 1);
    expect(regime.valor).toBeGreaterThan(160 * 3072.25 * 0.9);
    // Por ingressante, do ingresso à formatura: 2,5 x 4 x R$ 1.228,90 = R$ 12.289.
    expect(r.valorPorIngressante).toBeCloseTo(2.5 * 4 * 1228.9, 2);
  });

  it("o reajuste anual sobe o valor da matrícula a partir do ano do valor", () => {
    const r = simularOpcaoCurso(novo, { ...p, reajusteAnual: 0.05 });
    // O valor é de 2027 e a primeira linha é 2028: um ano de reajuste.
    expect(r.linhas[0]!.valorMatricula).toBeCloseTo(1228.9 * 1.05, 4);
    expect(r.linhas[2]!.valorMatricula).toBeCloseTo(1228.9 * 1.05 ** 3, 4);
  });

  it("sem reajuste o valor da matrícula fica constante", () => {
    const r = simularOpcaoCurso(novo, p);
    for (const l of r.linhas) expect(l.valorMatricula).toBeCloseTo(1228.9, 6);
  });
});
