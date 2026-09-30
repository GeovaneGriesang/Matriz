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
