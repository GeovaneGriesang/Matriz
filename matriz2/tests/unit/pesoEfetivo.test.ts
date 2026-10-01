import { describe, expect, it } from "vitest";
import { matriculaTotalDoCiclo, type CicloParaCalculo } from "@/lib/mdo/matriculaTotal";
import {
  QUALQUER,
  consolidarTabelaDePeso,
  deduzirPesoEfetivo,
  pesoEfetivoPelaTabela,
  type CicloObservado,
} from "@/lib/mdo/pesoEfetivo";

const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const periodo = { inicio: dia("2025-01-01"), fim: dia("2025-12-31") };

/** Ciclo regular de 3 anos que cobre o período inteiro, com a Matrícula Total calculada pelo motor com `pesoAplicado`. */
function ciclo(curso: string, pesoAplicado: number, extra: Partial<CicloObservado> = {}): CicloObservado {
  const c: CicloParaCalculo = {
    inicio: dia("2024-02-01"), termino: dia("2026-12-20"), jubilamento: dia("2029-12-20"), chCiclo: 1200, chMec: 1200,
    chMatriz: 1200, peso: pesoAplicado, agropecuaria: false, alunos: 40,
  };
  return {
    tipoCurso: "TECNICO", tipoOferta: "SUBSEQUENTE", curso, chMinimaMec: 1200, pesoColuna: 1,
    matriculaTotal: matriculaTotalDoCiclo(c, periodo), ciclo: c, ...extra,
  };
}

describe("tabela de peso efetivo", () => {
  it("deduz da Matrícula Total o peso que o motor aplicou", () => {
    expect(deduzirPesoEfetivo(ciclo("TECNICO EM INFORMATICA", 2), periodo)).toBeCloseTo(2, 3);
    expect(deduzirPesoEfetivo(ciclo("TECNICO EM AGROPECUARIA", 2 * 1.5), periodo)).toBeCloseTo(3, 3);
  });

  it("não deduz quando o ciclo não tem aluno ativo", () => {
    const vazio = ciclo("TECNICO EM INFORMATICA", 2);
    vazio.ciclo = { ...vazio.ciclo, alunos: 0 };
    expect(deduzirPesoEfetivo(vazio, periodo)).toBeNull();
  });

  it("consolida por chave e fica com o valor mais frequente, guardando o peso da coluna e a contagem", () => {
    const tabela = consolidarTabelaDePeso(
      [
        ciclo("TECNICO EM INFORMATICA", 2, { pesoColuna: 2 }),
        ciclo("TECNICO EM INFORMATICA", 2, { pesoColuna: 2 }),
        ciclo("TECNICO EM INFORMATICA", 1, { pesoColuna: 2 }),
        ciclo("TECNICO EM EDIFICACOES", 1.5, { pesoColuna: 1 }),
      ],
      periodo,
    );
    const info = tabela.find((l) => l.curso === "TECNICO EM INFORMATICA")!;
    expect(info.pesoEfetivo).toBe(2);
    expect(info.ciclosObservados).toBe(3);
    expect(info.ciclosConcordantes).toBe(2);
    const edif = tabela.find((l) => l.curso === "TECNICO EM EDIFICACOES")!;
    expect(edif.pesoEfetivo).toBe(1.5);
    expect(edif.pesoColuna).toBe(1);
  });

  it("sempre traz a regra do FIC fora do catálogo, com curinga em oferta e curso", () => {
    const fic = (curso: string) =>
      ciclo(curso, 2.5, { tipoCurso: "QUALIFICACAO PROFISSIONAL (FIC)", tipoOferta: "NÃO SE APLICA", chMinimaMec: 3200, pesoColuna: 1 });
    const tabela = consolidarTabelaDePeso([fic("OPERADOR DE COMPUTADOR"), fic("AUXILIAR ADMINISTRATIVO")], periodo);
    const regra = tabela.find((l) => l.origem === "REGRA_FIC_SEM_CATALOGO")!;
    expect(regra.tipoOferta).toBe(QUALQUER);
    expect(regra.curso).toBe(QUALQUER);
    expect(regra.pesoEfetivo).toBe(2.5);
    expect(regra.ciclosObservados).toBe(2);
    expect(regra.ciclosConcordantes).toBe(2);
  });

  it("procura a chave exata e, no FIC com mínima de 3.200 h, cai na regra; senão devolve null", () => {
    const tabela = [{ tipoCurso: "TECNICO", tipoOferta: "SUBSEQUENTE", curso: "TECNICO EM INFORMATICA", chMinimaMec: 1200, pesoEfetivo: 2 }];
    expect(pesoEfetivoPelaTabela(tabela, "TECNICO", "SUBSEQUENTE", "TECNICO EM INFORMATICA", 1200)).toBe(2);
    expect(pesoEfetivoPelaTabela(tabela, "TECNICO", "SUBSEQUENTE", "TECNICO EM INFORMATICA", 800)).toBeNull();
    expect(pesoEfetivoPelaTabela(tabela, "QUALIFICACAO PROFISSIONAL (FIC)", "NÃO SE APLICA", "QUALQUER CURSO NOVO", 3200)).toBe(2.5);
    expect(pesoEfetivoPelaTabela(tabela, "QUALIFICACAO PROFISSIONAL (FIC)", "NÃO SE APLICA", "QUALQUER CURSO NOVO", 160)).toBeNull();
  });
});
