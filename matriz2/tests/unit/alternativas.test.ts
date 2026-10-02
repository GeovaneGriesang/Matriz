import { describe, expect, it } from "vitest";
import {
  eixoDeAnos,
  melhores,
  resultadoDaAlternativa,
  type Alternativa,
  type AlternativaCurso,
  type ContextoAlternativas,
} from "@/lib/alternativas";
import { ganhoDoIndicador, proximoDegrau, valorAtualDoIndicador } from "@/lib/simulacaoIndicadores";

const ctx: ContextoAlternativas = {
  valorMatricula: 1228.9,
  anoDoValor: 2027,
  reajusteAnual: 0,
  orcamentoCampusHoje: 10_000_000,
  perdaCampus: 800_000,
  alunosCampus: 1000,
  indicadores: {
    // RAP de 19,5 (faixa baixa) numa rede com RAP ponderado de 400 nas outras instituições; bloco de R$ 20 milhões.
    rap: { rapPresencial: 19.5, restoRedeRapPonderado: 400 },
    iapl: { aplTecnico: 0.55, restoRedeTecnico: 20, aplFormacaoProfessor: 0.12, restoRedeFormacao: 3, aplProeja: 0.03, restoRedeProeja: 1 },
    totalBlocoRap: 20_000_000,
    totalBlocoIapl: 15_000_000,
  },
};
const anos = eixoDeAnos(2028, 8);

function curso(sobrescreve: Omit<Partial<AlternativaCurso>, "opcao"> & { opcao?: Partial<AlternativaCurso["opcao"]> }): AlternativaCurso {
  const { opcao, ...resto } = sobrescreve;
  return {
    tipo: "CURSO",
    id: "c",
    rotulo: "curso",
    primeiroAno: 2028,
    peso: 2.5,
    opcao: { rotulo: "curso", anosDuracao: 4, chTotalCiclo: 3200, chMatriz: 3200, vagasPorAno: 40, evasaoAnual: 0, ...opcao },
    ...resto,
  };
}

describe("comparador de alternativas", () => {
  it("o eixo de anos começa no ano inicial e tem o tamanho do horizonte", () => {
    expect(anos).toEqual([2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035]);
  });

  it("um curso novo só rende a partir do primeiro ano de entrada", () => {
    const r = resultadoDaAlternativa(curso({ primeiroAno: 2030 }), ctx, anos);
    expect(r.ganhoPorAno.slice(0, 2)).toEqual([0, 0]);
    expect(r.ganhoPorAno[2]).toBeGreaterThan(0);
    expect(r.anoDoPrimeiroGanho).toBe(2030);
  });

  it("três anos contra quatro, com a mesma CH, rendem o mesmo por ingressante; o de três chega antes ao ritmo de cruzeiro", () => {
    const tres = resultadoDaAlternativa(curso({ opcao: { anosDuracao: 3 } }), ctx, anos);
    const quatro = resultadoDaAlternativa(curso({ opcao: { anosDuracao: 4 } }), ctx, anos);
    // Em regime o repasse anual é o mesmo, mas o curso de 4 anos tem mais alunos matriculados.
    expect(Math.abs(tres.ganhoNoUltimoAno / quatro.ganhoNoUltimoAno - 1)).toBeLessThan(0.002);
    expect(quatro.alunosNovos).toBeGreaterThan(tres.alunosNovos);
    // Por aluno novo, o curso de 3 anos rende mais (cada aluno vale 4/3).
    expect(tres.ganhoPorAlunoNovo!).toBeGreaterThan(quatro.ganhoPorAlunoNovo!);
    // E o de 3 anos acumula mais no horizonte, porque chega ao regime antes.
    expect(tres.acumulado).toBeGreaterThan(quatro.acumulado);
  });

  it("uma turma FIC de 160 h rende pouco por aluno e nada exige depois de formada", () => {
    const fic = resultadoDaAlternativa(
      curso({ peso: 1, opcao: { anosDuracao: 1, mesesDuracao: 4, chTotalCiclo: 160, chMatriz: 160, vagasPorAno: 80 } }),
      ctx,
      anos,
    );
    // 80 alunos x peso 1 x (160 ÷ 800) = 16 de Matrícula Total por ano.
    expect(fic.ganhoPorAno[0]).toBeCloseTo(16 * 1228.9, 2);
    expect(fic.ganhoNoUltimoAno).toBeCloseTo(16 * 1228.9, 2);
    expect(fic.acumulado).toBeCloseTo(8 * 16 * 1228.9, 2);
  });

  it("reduzir a evasão soma uma fração da perda de hoje, sem aluno novo", () => {
    const r = resultadoDaAlternativa({ tipo: "EVASAO", id: "e", rotulo: "evasão", primeiroAno: 2029, reducaoPct: 25 }, ctx, anos);
    expect(r.ganhoPorAno[0]).toBe(0);
    expect(r.ganhoPorAno[1]).toBeCloseTo(200_000, 2);
    expect(r.alunosNovos).toBe(0);
    expect(r.ganhoPorAlunoNovo).toBeNull();
  });

  it("crescer a matrícula soma uma fração do que o câmpus recebe e conta os alunos novos", () => {
    const r = resultadoDaAlternativa({ tipo: "MATRICULA", id: "m", rotulo: "matrícula", primeiroAno: 2028, crescimentoPct: 5 }, ctx, anos);
    expect(r.ganhoNoUltimoAno).toBeCloseTo(500_000, 2);
    expect(r.alunosNovos).toBeCloseTo(50, 6);
    expect(r.ganhoPorAlunoNovo).toBeCloseTo(10_000, 4);
  });

  it("subir a RAP para a faixa seguinte rende; ficar na mesma faixa não muda nada", () => {
    const sobe = resultadoDaAlternativa({ tipo: "INDICADOR", id: "r", rotulo: "RAP", primeiroAno: 2028, indicador: "RAP", novoValor: 20.5 }, ctx, anos);
    const igual = resultadoDaAlternativa({ tipo: "INDICADOR", id: "r2", rotulo: "RAP", primeiroAno: 2028, indicador: "RAP", novoValor: 19.8 }, ctx, anos);
    expect(sobe.ganhoNoUltimoAno).toBeGreaterThan(0);
    // 19,5 e 19,8 estão na mesma faixa (peso 1), mas o ponderado muda um pouco com o valor; o salto grande é o de faixa.
    expect(igual.ganhoNoUltimoAno).toBeLessThan(sobe.ganhoNoUltimoAno);
    expect(sobe.alunosNovos).toBe(0);
  });

  it("os degraus dos indicadores dizem quanto falta para a próxima faixa", () => {
    expect(proximoDegrau("RAP", 19.5)).toMatchObject({ valor: 20, peso: 2 });
    expect(proximoDegrau("RAP", 19.5)!.falta).toBeCloseTo(0.5, 9);
    expect(proximoDegrau("RAP", 23)).toBeNull();
    expect(proximoDegrau("IAPL_TECNICO", 0.55)).toMatchObject({ valor: 0.6 });
    expect(valorAtualDoIndicador("IAPL_PROEJA", ctx.indicadores)).toBe(0.03);
    expect(valorAtualDoIndicador("RAP", { ...ctx.indicadores, rap: null })).toBeNull();
    expect(ganhoDoIndicador("RAP", 25, { ...ctx.indicadores, rap: null })).toBe(0);
  });

  it("aponta a que mais rende no acumulado e a que começa antes", () => {
    const lista: Alternativa[] = [
      curso({ id: "c1", rotulo: "curso", primeiroAno: 2030 }),
      { tipo: "EVASAO", id: "e", rotulo: "evasão", primeiroAno: 2028, reducaoPct: 10 },
    ];
    const rs = lista.map((a) => resultadoDaAlternativa(a, ctx, anos));
    const { maisRende, maisRapida } = melhores(rs);
    expect(maisRapida!.id).toBe("e");
    expect(maisRende!.acumulado).toBe(Math.max(...rs.map((r) => r.acumulado)));
    expect(melhores([]).maisRende).toBeNull();
  });
});
