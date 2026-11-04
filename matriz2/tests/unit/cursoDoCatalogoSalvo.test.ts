import { describe, expect, it } from "vitest";
import { comCursoDoCatalogo, resolverCursosDoCatalogo, type CursoNovoSalvo } from "@/lib/cenarioProjecao";

const info = { curso: "TECNICO EM INFORMATICA", tipoCurso: "TECNICO", tipoOferta: "INTEGRADO", chMinimaMec: 1200 };
const refri = { curso: "TECNICO EM REFRIGERACAO E CLIMATIZACAO", tipoCurso: "TECNICO", tipoOferta: "INTEGRADO", chMinimaMec: 1200 };
const outro = { curso: "ADMINISTRACAO", tipoCurso: "BACHARELADO", tipoOferta: "NÃO SE APLICA", chMinimaMec: 3000 };

describe("curso novo salvo no cenário", () => {
  it("a tabela de pesos muda de ordem e o curso continua o mesmo", () => {
    const salvo = comCursoDoCatalogo([{ catalogoIdx: 0 }], [info, refri]);
    const carregado = resolverCursosDoCatalogo(salvo, [outro, refri, info]);
    expect(carregado[0]!.catalogoIdx).toBe(2);
  });

  it("curso que saiu da tabela volta a não escolhido, em vez de virar outro", () => {
    const salvo = comCursoDoCatalogo([{ catalogoIdx: 0 }], [info]);
    expect(resolverCursosDoCatalogo(salvo, [outro])[0]!.catalogoIdx).toBe(-1);
  });

  it("cenário antigo, sem o nome do curso, fica como está", () => {
    expect(resolverCursosDoCatalogo([{ catalogoIdx: 1 }], [info, refri])[0]!.catalogoIdx).toBe(1);
  });

  it("curso ainda não escolhido não ganha nome", () => {
    expect(comCursoDoCatalogo<CursoNovoSalvo>([{ catalogoIdx: -1 }], [info])[0]!.cursoDoCatalogo).toBeUndefined();
  });
});
