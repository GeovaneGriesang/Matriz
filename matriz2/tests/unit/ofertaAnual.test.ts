import { describe, expect, it } from "vitest";
import { cursoDaChave, rotuloDoCursoEscolhido } from "@/lib/cursoEscolhido";
import { modelosDeOfertaAnual, turmasDeReposicaoDoConjunto, type CicloProjetavel, type Premissas } from "@/lib/mdo/projecaoCiclos";

const dia = (a: number, m: number, d: number) => new Date(Date.UTC(a, m - 1, d));
const SEM_PERDA: Premissas = { evasao: { presencial: 0, ead: 0 }, retencao: [0, 0, 0] };

function turma(id: number, inicio: Date, termino: Date, alunos: number, sobre: Partial<CicloProjetavel> = {}): CicloProjetavel {
  return { id, unidadeId: 1, curso: "INFORMATICA", tipoCurso: "TECNICO", tipoOferta: "INTEGRADO", repasse: "PRESENCIAL", inicio, termino, jubilamento: new Date(termino.getTime() + 1000 * 86_400_000), chCiclo: 3200, chMec: 3200, chMatriz: 3200, peso: 1.5, agropecuaria: false, alunos, valorPorMT: 1000, ...sobre };
}

// A situação de Venâncio Aires: a turma de 2023 era de 3 anos, e as de 2024 e 2025 são de 4.
const integrado = [turma(1, dia(2023, 4, 1), dia(2026, 3, 31), 62), turma(2, dia(2024, 2, 1), dia(2027, 12, 20), 63), turma(3, dia(2025, 3, 10), dia(2028, 12, 21), 64)];

describe("oferta anual: a reposição segue a turma mais recente", () => {
  it("reconhece o curso que abre uma turma por ano e usa a mais nova como modelo", () => {
    expect([...modelosDeOfertaAnual(integrado, 2025).entries()]).toEqual([[1, 3], [2, 3], [3, 3]]);
  });

  it("entra uma turma por ano, sem buraco nem ano com duas, e todas na conta da turma mais nova", () => {
    const porCiclo = turmasDeReposicaoDoConjunto(integrado, 2025, 8, SEM_PERDA);
    expect(porCiclo[0]).toEqual([]);
    expect(porCiclo[1]).toEqual([]);
    expect(porCiclo[2]!.map((t) => t.anoEntrada)).toEqual([2026, 2027, 2028, 2029, 2030, 2031, 2032]);
  });

  it("a turma nova tem o tamanho e a duração da mais recente: não copia a de 3 anos", () => {
    const [primeira] = turmasDeReposicaoDoConjunto(integrado, 2025, 8, SEM_PERDA)[2]!;
    const comecaEm2026 = primeira!.pontos.map((p) => p.alunosContados);
    expect(comecaEm2026[1]).toBeCloseTo(64, 6);
    expect(comecaEm2026[4]).toBeCloseTo(64, 6); // 2029 ainda é ano regular: a turma de 4 anos termina em dezembro.
  });

  it("não trata como anual o curso com ano sem entrada, nem o de ciclo curto, nem dois ciclos no mesmo ano", () => {
    const comBuraco = [turma(1, dia(2022, 3, 1), dia(2025, 12, 20), 30), turma(2, dia(2025, 3, 1), dia(2028, 12, 20), 30)];
    expect(modelosDeOfertaAnual(comBuraco, 2025).size).toBe(0);
    const curto = [turma(1, dia(2024, 3, 1), dia(2025, 2, 1), 30), turma(2, dia(2025, 3, 1), dia(2026, 2, 1), 30)];
    expect(modelosDeOfertaAnual(curto, 2025).size).toBe(0);
    const semestral = [turma(1, dia(2025, 3, 1), dia(2028, 12, 20), 30), turma(2, dia(2025, 8, 1), dia(2029, 7, 20), 30)];
    expect(modelosDeOfertaAnual(semestral, 2025).size).toBe(0);
  });

  it("os outros cursos seguem a regra de antes", () => {
    const unica = [turma(1, dia(2025, 3, 1), dia(2028, 12, 20), 30)];
    expect(turmasDeReposicaoDoConjunto(unica, 2025, 8, SEM_PERDA)[0]!.map((t) => t.anoEntrada)).toEqual([2029]);
  });
});

describe("o curso escolhido entre as abas", () => {
  it("lê os dois formatos de chave", () => {
    expect(cursoDaChave("TECNICO|INTEGRADO|TECNICO EM INFORMATICA|1200")).toEqual({ curso: "TECNICO EM INFORMATICA", oferta: "INTEGRADO" });
    expect(cursoDaChave("TECNICO EM INFORMATICA|INTEGRADO")).toEqual({ curso: "TECNICO EM INFORMATICA", oferta: "INTEGRADO" });
    expect(cursoDaChave(undefined)).toBeNull();
    expect(cursoDaChave("errado")).toBeNull();
  });

  it("escreve o nome com a oferta quando ela diz algo", () => {
    expect(rotuloDoCursoEscolhido({ curso: "TECNICO EM INFORMATICA", oferta: "INTEGRADO" })).toBe("TECNICO EM INFORMATICA (integrado)");
    expect(rotuloDoCursoEscolhido({ curso: "PEDAGOGIA", oferta: "NÃO SE APLICA" })).toBe("PEDAGOGIA");
  });
});
