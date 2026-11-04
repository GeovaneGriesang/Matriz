import { describe, expect, it } from "vitest";
import { compararCursosEntreCiclos, type TurmaDeEntrada } from "@/lib/cursosEntreCiclos";

const turma = (id: number, codigoCiclo: string, curso: string, valor: number, inicio: string, extra: Partial<TurmaDeEntrada> = {}): TurmaDeEntrada => ({
  id,
  codigoCiclo,
  curso,
  repasse: "PRESENCIAL",
  valor,
  inicio: `${inicio}T00:00:00.000Z`,
  termino: "2026-03-18T00:00:00.000Z",
  modalidadeRotulo: "Técnico integrado",
  ...extra,
});

describe("cursos lado a lado entre dois ciclos", () => {
  it("a mesma turma fica na mesma linha, e o lado em que ela não existe fica vazio", () => {
    const [info] = compararCursosEntreCiclos(
      [turma(1, "A", "TECNICO EM INFORMATICA", 100, "2022-05-16"), turma(2, "B", "TECNICO EM INFORMATICA", 200, "2023-04-01")],
      [turma(3, "B", "TECNICO EM INFORMATICA", 250, "2023-04-01"), turma(4, "C", "TECNICO EM INFORMATICA", 50, "2025-03-10")],
      2026,
      2027,
    );
    expect(info!.turmas.map((t) => [t.chave, t.valorA, t.valorB])).toEqual([
      ["A", 100, null],
      ["B", 200, 250],
      ["C", null, 50],
    ]);
    expect([info!.totalA, info!.totalB]).toEqual([300, 300]);
  });

  it("o curso que só existe num dos ciclos também aparece, e os cursos vêm do maior valor para o menor", () => {
    const r = compararCursosEntreCiclos([turma(1, "A", "PEQUENO", 10, "2023-01-01")], [turma(2, "B", "GRANDE", 90, "2024-01-01")], 2026, 2027);
    expect(r.map((c) => c.curso)).toEqual(["GRANDE", "PEQUENO"]);
    expect(r[1]!.turmas[0]!.valorB).toBeNull();
  });

  it("a mesma turma pode ser regular num ciclo e retida no outro", () => {
    const termino = { termino: "2024-12-20T00:00:00.000Z" };
    const [c] = compararCursosEntreCiclos([turma(1, "A", "CURSO", 100, "2021-07-21", termino)], [turma(2, "A", "CURSO", 20, "2021-07-21", termino)], 2026, 2027);
    expect(c!.turmas[0]).toMatchObject({ retidaA: false, retidaB: true });
  });

  it("o rótulo traz sempre o ciclo, a modalidade e o período, sem errar o dia por causa do fuso", () => {
    const [c] = compararCursosEntreCiclos([turma(1, "A", "CURSO", 1, "2023-04-01")], [], 2026, 2027);
    expect(c!.turmas[0]!.rotulo).toBe("Turma A, Técnico integrado, 01/04/2023 a 18/03/2026");
  });

  it("repasse a distância entra no rótulo, e turmas iguais em tudo se diferenciam pelo código do ciclo", () => {
    const [c] = compararCursosEntreCiclos(
      [turma(1, "A", "CURSO", 1, "2023-04-01", { repasse: "EAD_FP" }), turma(2, "B", "CURSO", 1, "2023-04-01", { repasse: "EAD_FP" })],
      [],
      2026,
      2027,
    );
    expect(c!.turmas.map((t) => t.rotulo)).toEqual([
      "Turma A, Técnico integrado, EAD FP, 01/04/2023 a 18/03/2026",
      "Turma B, Técnico integrado, EAD FP, 01/04/2023 a 18/03/2026",
    ]);
  });
});
