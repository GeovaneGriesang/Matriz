import { describe, expect, it } from "vitest";
import { matriculaTotalDoCiclo } from "@/lib/mdo/matriculaTotal";
import {
  alunosNoAno,
  periodoDoAnoBase,
  projetarMatriculados,
  projetarReposicao,
  retencaoObservada,
  situacaoDoCiclo,
  somarProjecao,
  type CicloProjetavel,
  type Premissas,
} from "@/lib/mdo/projecaoCiclos";

const dia = (a: number, m: number, d: number) => new Date(Date.UTC(a, m - 1, d));

/** Curso superior de 5 anos que começou em 2025 (março) e termina em fevereiro de 2030. */
function cursoDeCincoAnos(sobre: Partial<CicloProjetavel> = {}): CicloProjetavel {
  return {
    id: 1,
    unidadeId: 1,
    curso: "ENGENHARIA",
    tipoCurso: "BACHARELADO",
    tipoOferta: "NÃO SE APLICA",
    repasse: "PRESENCIAL",
    inicio: dia(2025, 3, 1),
    termino: dia(2030, 2, 28),
    jubilamento: dia(2033, 2, 27),
    chCiclo: 4000,
    chMec: 3600,
    chMatriz: 3600,
    peso: 2,
    agropecuaria: false,
    alunos: 40,
    valorPorMT: 1000,
    ...sobre,
  };
}

/** Premissas de teste: sem evasão, e todos os alunos continuam retidos depois do término (para isolar o que cada teste verifica). */
const SEM_EVASAO: Premissas = { evasao: { presencial: 0, ead: 0 }, retencao: [1, 1, 1] };
const com = (presencial: number, ead = 0, retencao: readonly number[] = [1, 1, 1]): Premissas => ({ evasao: { presencial, ead }, retencao });

describe("alunosNoAno", () => {
  it("até o término só a evasão desgasta, depois sobra a fração retida", () => {
    const termino = dia(2028, 6, 30);
    const r = [0.5, 0.2, 0.1];
    const ref = { alunos: 100, ano: 2025 };
    expect(alunosNoAno(ref, termino, 2026, 0.1, r)).toBeCloseTo(90, 9);
    expect(alunosNoAno(ref, termino, 2028, 0.1, r)).toBeCloseTo(72.9, 9);
    expect(alunosNoAno(ref, termino, 2029, 0.1, r)).toBeCloseTo(72.9 * 0.5, 9);
    expect(alunosNoAno(ref, termino, 2031, 0.1, r)).toBeCloseTo(72.9 * 0.1, 9);
    expect(alunosNoAno(ref, termino, 2032, 0.1, r)).toBe(0);
  });

  it("quem já é retido hoje segue a curva a partir de onde está", () => {
    const termino = dia(2024, 6, 30);
    const r = [0.5, 0.2, 0.1];
    expect(alunosNoAno({ alunos: 50, ano: 2025 }, termino, 2026, 0.1, r)).toBeCloseTo(50 * (0.2 / 0.5), 9);
    expect(alunosNoAno({ alunos: 50, ano: 2025 }, termino, 2027, 0.1, r)).toBeCloseTo(50 * (0.1 / 0.5), 9);
  });
});

describe("projetarMatriculados", () => {
  it("o primeiro ano é a Matrícula Total de hoje, calculada pelo motor da MDO", () => {
    const c = cursoDeCincoAnos();
    const mtMotor = matriculaTotalDoCiclo(
      { inicio: c.inicio, termino: c.termino, jubilamento: c.jubilamento, chCiclo: c.chCiclo, chMec: c.chMec, chMatriz: c.chMatriz, peso: c.peso, agropecuaria: false, alunos: 40 },
      periodoDoAnoBase(2025),
    );
    const [primeiro] = projetarMatriculados(c, 2025, 5, SEM_EVASAO);
    expect(primeiro!.matriculaTotal).toBeCloseTo(mtMotor, 9);
    expect(primeiro!.valor).toBeCloseTo(mtMotor * 1000, 6);
  });

  it("o curso de 5 anos que começou em 2025 ainda rende até o ano em que termina, e depois só como retido", () => {
    const pontos = projetarMatriculados(cursoDeCincoAnos(), 2025, 8, SEM_EVASAO);
    const por = Object.fromEntries(pontos.map((p) => [p.anoBase, p]));
    for (const ano of [2026, 2027, 2028, 2029, 2030]) expect(por[ano]!.matriculaTotal).toBeGreaterThan(0);
    // 2031 em diante: o término foi em 2030, o aluno retido conta meio ano (ICQA 0,5) até o jubilamento em 2033.
    expect(por[2031]!.alunosContados).toBeCloseTo(20, 9);
    expect(por[2031]!.matriculaTotal).toBeLessThan(por[2029]!.matriculaTotal);
    expect(por[2032]!.alunosContados).toBeCloseTo(20, 9);
  });

  it("a retenção reduz o que sobra depois do término", () => {
    const pontos = projetarMatriculados(cursoDeCincoAnos(), 2025, 9, com(0, 0, [0.4, 0.2, 0.1]));
    const por = Object.fromEntries(pontos.map((p) => [p.anoBase, p]));
    expect(por[2031]!.alunosContados).toBeCloseTo(40 * 0.4 * 0.5, 9);
    expect(por[2032]!.alunosContados).toBeCloseTo(40 * 0.2 * 0.5, 9);
    expect(por[2033]!.alunosContados).toBeCloseTo(40 * 0.1 * 0.5, 9);
  });

  it("a evasão reduz os alunos de cada ano na proporção composta", () => {
    const pontos = projetarMatriculados(cursoDeCincoAnos(), 2025, 4, com(0.1));
    expect(pontos[0]!.alunosContados).toBeCloseTo(40, 9);
    expect(pontos[1]!.alunosContados).toBeCloseTo(36, 9);
    expect(pontos[2]!.alunosContados).toBeCloseTo(32.4, 9);
  });

  it("curso a distância usa a taxa da modalidade a distância", () => {
    const ead = cursoDeCincoAnos({ repasse: "EAD" });
    const pontos = projetarMatriculados(ead, 2025, 2, com(0.5, 0.1));
    expect(pontos[1]!.alunosContados).toBeCloseTo(36, 9);
  });

  it("ciclo já jubilado não rende nada em nenhum ano", () => {
    const velho = cursoDeCincoAnos({ inicio: dia(2015, 3, 1), termino: dia(2019, 12, 20), jubilamento: dia(2022, 12, 20) });
    for (const p of projetarMatriculados(velho, 2025, 5, SEM_EVASAO)) expect(p.matriculaTotal).toBe(0);
  });
});

describe("projetarReposicao", () => {
  it("ciclo regular ganha uma turma nova no dia seguinte ao término, com o mesmo tamanho (sem evasão)", () => {
    const c = cursoDeCincoAnos({ inicio: dia(2022, 3, 1), termino: dia(2026, 12, 20), jubilamento: dia(2029, 12, 20) });
    const pontos = projetarReposicao(c, 2025, 6, SEM_EVASAO);
    expect(pontos[0]!.valor).toBe(0);
    // A turma nova entra em 21/12/2026: em 2026 só contam os 11 dias finais, em 2027 o ano inteiro, e depois mais até o regime.
    expect(pontos[1]!.valor).toBeGreaterThan(0);
    expect(pontos[2]!.valor).toBeGreaterThan(pontos[1]!.valor * 5);
  });

  it("não repõe ciclo que já terminou (aluno retido) nem ciclo sem alunos", () => {
    const retido = cursoDeCincoAnos({ inicio: dia(2019, 3, 1), termino: dia(2023, 12, 20), jubilamento: dia(2026, 12, 20) });
    expect(projetarReposicao(retido, 2025, 5, SEM_EVASAO).every((p) => p.valor === 0)).toBe(true);
    expect(projetarReposicao(cursoDeCincoAnos({ alunos: 0 }), 2025, 5, SEM_EVASAO).every((p) => p.valor === 0)).toBe(true);
  });

  it("a turma nova é estimada maior que a matrícula de hoje quando há evasão, mas nunca mais de 3 vezes", () => {
    const c = cursoDeCincoAnos({ inicio: dia(2022, 3, 1), termino: dia(2026, 12, 20), alunos: 10 });
    const comEvasao = projetarReposicao(c, 2025, 8, com(0.4, 0.4));
    const sem = projetarReposicao(c, 2025, 8, SEM_EVASAO);
    const soma = (p: { alunosContados: number }[]) => p.reduce((s, x) => s + x.alunosContados, 0);
    expect(soma(comEvasao)).toBeGreaterThan(0);
    expect(soma(comEvasao)).toBeLessThan(soma(sem) * 3 + 1);
  });

  it("um curso de 4 anos com uma turma por ano mantém o valor total em regime quando cada turma é reposta", () => {
    const turma = (ano: number, id: number) =>
      cursoDeCincoAnos({ id, inicio: dia(ano, 3, 1), termino: dia(ano + 4, 2, 28), jubilamento: dia(ano + 7, 2, 28), chCiclo: 3600, chMatriz: 3600, alunos: 30 });
    const turmas = [turma(2022, 1), turma(2023, 2), turma(2024, 3), turma(2025, 4)];
    // Sem ninguém retido depois do término, o total em regime não pode afundar nem duplicar: fica perto do valor de 2025.
    const total = somarProjecao(turmas, 2025, 6, com(0, 0, [0, 0, 0])).map((r) => r.valor + r.valorReposicao);
    for (const v of total.slice(1)) expect(Math.abs(v / total[0]! - 1)).toBeLessThan(0.2);
    const apos2028 = total.slice(3);
    for (const v of apos2028) expect(Math.abs(v / apos2028[0]! - 1)).toBeLessThan(0.02);
  });

  it("a turma seguinte que já cabe no ano-base inicial não é contada de novo", () => {
    // Término em junho de 2025 e duração de 5 anos: a turma seguinte entra em julho de 2025, que já é dado de hoje.
    const c = cursoDeCincoAnos({ inicio: dia(2020, 7, 1), termino: dia(2025, 6, 30), jubilamento: dia(2028, 6, 30) });
    expect(projetarReposicao(c, 2025, 6, SEM_EVASAO).every((p) => p.valor === 0)).toBe(true);
  });

  it("ciclo curto (FIC) é reposto uma vez por ano, e não um atrás do outro", () => {
    const fic = cursoDeCincoAnos({
      tipoCurso: "QUALIFICACAO PROFISSIONAL (FIC)",
      inicio: dia(2025, 5, 1),
      termino: dia(2025, 5, 20),
      jubilamento: dia(2025, 5, 20),
      chCiclo: 160,
      chMec: 160,
      chMatriz: 160,
      peso: 1,
      alunos: 30,
    });
    const hoje = projetarMatriculados(fic, 2025, 1, SEM_EVASAO)[0]!.valor;
    const reposto = projetarReposicao(fic, 2025, 4, SEM_EVASAO);
    for (const p of reposto.slice(1)) expect(p.valor).toBeCloseTo(hoje, 6);
  });
});

describe("retencaoObservada", () => {
  const ciclo = (anoTermino: number, alunos: number, tipoCurso = "TECNICO") => ({ termino: dia(anoTermino, 6, 30), alunos, tipoCurso });

  it("mede quantos alunos dos que terminam no ano-base aparecem em ciclos terminados 1, 2 e 3 anos antes", () => {
    const r = retencaoObservada([ciclo(2025, 1000), ciclo(2024, 400), ciclo(2023, 150), ciclo(2022, 80)], 2025);
    expect(r.observada).toBe(true);
    expect(r.retencao[0]).toBeCloseTo(0.4, 9);
    expect(r.retencao[1]).toBeCloseTo(0.15, 9);
    expect(r.retencao[2]).toBeCloseTo(0.08, 9);
  });

  it("a curva nunca sobe: cada ano retido é no máximo o anterior", () => {
    const r = retencaoObservada([ciclo(2025, 1000), ciclo(2024, 200), ciclo(2023, 500)], 2025);
    expect(r.retencao[1]).toBeLessThanOrEqual(r.retencao[0]!);
  });

  it("ignora o FIC e, com poucos alunos no término, devolve a curva padrão", () => {
    const poucos = retencaoObservada([ciclo(2025, 10), ciclo(2024, 8)], 2025);
    expect(poucos.observada).toBe(false);
    const soFic = retencaoObservada([ciclo(2025, 1000, "QUALIFICACAO PROFISSIONAL (FIC)"), ciclo(2024, 900, "QUALIFICACAO PROFISSIONAL (FIC)")], 2025);
    expect(soFic.observada).toBe(false);
  });
});

describe("somarProjecao e situacaoDoCiclo", () => {
  it("o ano do ciclo orçamentário é o ano-base mais dois", () => {
    const resumo = somarProjecao([cursoDeCincoAnos()], 2025, 5, SEM_EVASAO);
    expect(resumo.map((r) => r.anoCiclo)).toEqual([2027, 2028, 2029, 2030, 2031]);
  });

  it("a soma é a soma dos ciclos", () => {
    const a = cursoDeCincoAnos({ id: 1 });
    const b = cursoDeCincoAnos({ id: 2, alunos: 20 });
    const juntos = somarProjecao([a, b], 2025, 3, SEM_EVASAO);
    const sozinhoA = somarProjecao([a], 2025, 3, SEM_EVASAO);
    const sozinhoB = somarProjecao([b], 2025, 3, SEM_EVASAO);
    for (let k = 0; k < 3; k++) expect(juntos[k]!.valor).toBeCloseTo(sozinhoA[k]!.valor + sozinhoB[k]!.valor, 6);
  });

  it("diz se o ciclo é regular e até quando conta", () => {
    expect(situacaoDoCiclo(cursoDeCincoAnos(), 2025)).toEqual({ anoTermino: 2030, regular: true, ultimoAnoComValor: 2033 });
    expect(situacaoDoCiclo({ termino: dia(2023, 12, 20), jubilamento: dia(2026, 12, 20) }, 2025).regular).toBe(false);
  });
});
