import { describe, expect, it } from "vitest";
import {
  projetarCursoNovo,
  projetarReposicao,
  turmasDeCursoNovo,
  turmasDeReposicao,
  ultimoAnoDeTermino,
  type CicloProjetavel,
  type CursoNovo,
  type Premissas,
} from "@/lib/mdo/projecaoCiclos";

const dia = (a: number, m: number, d: number) => new Date(Date.UTC(a, m - 1, d));
const SEM_PERDA: Premissas = { evasao: { presencial: 0, ead: 0 }, retencao: [0, 0, 0] };

/** Curso de 4 anos que entra todo ano em março; a turma de 2025 está em andamento. */
function turmaAtual(sobre: Partial<CicloProjetavel> = {}): CicloProjetavel {
  return {
    id: 1,
    unidadeId: 1,
    curso: "ENGENHARIA",
    tipoCurso: "BACHARELADO",
    tipoOferta: "NÃO SE APLICA",
    repasse: "PRESENCIAL",
    inicio: dia(2025, 3, 1),
    termino: dia(2029, 2, 28),
    jubilamento: dia(2032, 2, 27),
    chCiclo: 3600,
    chMec: 3600,
    chMatriz: 3600,
    peso: 2,
    agropecuaria: false,
    alunos: 30,
    valorPorMT: 1000,
    ...sobre,
  };
}

function cursoNovo(sobre: Partial<CursoNovo> = {}): CursoNovo {
  return {
    tipoCurso: "TECNICO",
    repasse: "PRESENCIAL",
    peso: 1.5,
    chMatriz: 3000,
    valorPorMT: 1000,
    primeiroAnoEntrada: 2028,
    ultimoAnoEntrada: 2028,
    mesInicio: 3,
    ingressantes: 40,
    duracaoAnos: 3,
    ...sobre,
  };
}

describe("turmasDeReposicao e o fim da oferta de um curso", () => {
  it("devolve uma turma por ano, cada uma com o ano em que entra", () => {
    const turmas = turmasDeReposicao(turmaAtual(), 2025, 10, SEM_PERDA);
    expect(turmas.map((t) => t.anoEntrada)).toEqual([2029, 2033]);
  });

  it("parar de ofertar tira as turmas novas a partir do ano, mas deixa as que já entraram", () => {
    const c = turmaAtual({ inicio: dia(2022, 3, 1), termino: dia(2026, 2, 28) });
    const tudo = projetarReposicao(c, 2025, 12, SEM_PERDA);
    const ateOAnoDaPrimeira = projetarReposicao(c, 2025, 12, SEM_PERDA, 2026);
    const semNenhuma = projetarReposicao(c, 2025, 12, SEM_PERDA, 2025);
    const soma = (p: { valor: number }[]) => p.reduce((s, x) => s + x.valor, 0);
    expect(soma(semNenhuma)).toBe(0);
    expect(soma(ateOAnoDaPrimeira)).toBeGreaterThan(0);
    expect(soma(ateOAnoDaPrimeira)).toBeLessThan(soma(tudo));
    // A turma de 2026 continua até o fim do curso mesmo depois de o curso ter parado de ser ofertado.
    expect(ateOAnoDaPrimeira[ateOAnoDaPrimeira.length - 1]!.valor).toBe(0);
    expect(ateOAnoDaPrimeira[3]!.valor).toBeGreaterThan(0);
  });
});

describe("cursos novos", () => {
  it("uma turma só: rende do ano em que entra até terminar, e não antes", () => {
    const pontos = projetarCursoNovo(cursoNovo(), 2025, 12, SEM_PERDA);
    const por = Object.fromEntries(pontos.map((p) => [p.anoBase, p]));
    expect(por[2027]!.valor).toBe(0);
    expect(por[2028]!.valor).toBeGreaterThan(0);
    expect(por[2030]!.valor).toBeGreaterThan(0);
    // Depois do término (fevereiro de 2031) e sem retidos, não rende mais.
    expect(por[2032]!.valor).toBe(0);
  });

  it("o valor de um aluno ao longo do curso é o peso x carga horária / 800 x valor da matrícula", () => {
    const pontos = projetarCursoNovo(cursoNovo({ ingressantes: 1, duracaoAnos: 3 }), 2025, 12, SEM_PERDA);
    const total = pontos.reduce((s, p) => s + p.valor, 0);
    expect(total).toBeCloseTo(1.5 * (3000 / 800) * 1000, -1);
  });

  it("repetir a oferta todo ano gera uma turma por ano", () => {
    const turmas = turmasDeCursoNovo(cursoNovo({ primeiroAnoEntrada: 2027, ultimoAnoEntrada: 2030 }), 2025, 12, SEM_PERDA);
    expect(turmas.map((t) => t.anoEntrada)).toEqual([2027, 2028, 2029, 2030]);
  });

  it("a evasão reduz o valor e a distância vale uma fração do presencial", () => {
    const base = projetarCursoNovo(cursoNovo(), 2025, 12, SEM_PERDA).reduce((s, p) => s + p.valor, 0);
    const comEvasao = projetarCursoNovo(cursoNovo(), 2025, 12, { evasao: { presencial: 0.2, ead: 0.2 }, retencao: [0, 0, 0] }).reduce((s, p) => s + p.valor, 0);
    expect(comEvasao).toBeLessThan(base);
    const ead = projetarCursoNovo(cursoNovo({ valorPorMT: 250 }), 2025, 12, SEM_PERDA).reduce((s, p) => s + p.valor, 0);
    expect(ead).toBeCloseTo(base / 4, 6);
  });

  it("curso semestral: duas turmas por ano, a segunda seis meses depois, e o dobro do valor de um curso anual", () => {
    const anual = projetarCursoNovo(cursoNovo(), 2025, 12, SEM_PERDA).reduce((s, p) => s + p.valor, 0);
    const semestral = cursoNovo({ entradasPorAno: 2 });
    expect(turmasDeCursoNovo(semestral, 2025, 12, SEM_PERDA).map((t) => t.anoEntrada)).toEqual([2028, 2028]);
    expect(projetarCursoNovo(semestral, 2025, 12, SEM_PERDA).reduce((s, p) => s + p.valor, 0)).toBeCloseTo(anual * 2, 6);
  });

  it("semestral em vários anos: a segunda turma de agosto pode cair no ano seguinte quando a primeira é depois de junho", () => {
    const turmas = turmasDeCursoNovo(cursoNovo({ entradasPorAno: 2, mesInicio: 9, primeiroAnoEntrada: 2027, ultimoAnoEntrada: 2028 }), 2025, 12, SEM_PERDA);
    // Setembro/2027, março/2028 e setembro/2028; a de março/2029 já passa do último ano.
    expect(turmas.map((t) => t.anoEntrada)).toEqual([2027, 2028, 2028]);
  });

  it("curso de um semestre (0,5 ano) termina no mesmo ano e rende o mesmo por aluno: peso x CH / 800 x valor", () => {
    const um = cursoNovo({ duracaoAnos: 0.5, ingressantes: 1, chMatriz: 800, peso: 1 });
    const total = projetarCursoNovo(um, 2025, 12, SEM_PERDA).reduce((s, p) => s + p.valor, 0);
    expect(total).toBeCloseTo(1 * (800 / 800) * 1000, -1);
  });

  it("turmas que começam depois do horizonte não entram", () => {
    const pontos = projetarCursoNovo(cursoNovo({ primeiroAnoEntrada: 2040, ultimoAnoEntrada: 2040 }), 2025, 8, SEM_PERDA);
    expect(pontos.every((p) => p.valor === 0)).toBe(true);
  });
});

describe("ultimoAnoDeTermino", () => {
  it("é o maior entre o fim dos ciclos regulares de hoje e o fim das turmas dos cursos novos", () => {
    expect(ultimoAnoDeTermino([turmaAtual()], [], 2025)).toBe(2029);
    expect(ultimoAnoDeTermino([turmaAtual()], [cursoNovo({ primeiroAnoEntrada: 2028, ultimoAnoEntrada: 2030 })], 2025)).toBe(2033);
  });

  it("ignora ciclos sem alunos e ciclos já terminados", () => {
    const sem = turmaAtual({ alunos: 0 });
    const velho = turmaAtual({ termino: dia(2023, 12, 20) });
    expect(ultimoAnoDeTermino([sem, velho], [], 2025)).toBe(2025);
  });
});
