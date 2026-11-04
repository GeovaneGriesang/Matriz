import { describe, expect, it } from "vitest";
import { montarExemplos, type DadosDosExemplos } from "@/lib/exemplosDoGuia";
import { FICHAS_DAS_TELAS, TELAS_DE_ADMINISTRACAO } from "@/lib/guiaDasTelas";

const completo: DadosDosExemplos = {
  ano: 2027,
  rede: { referencia: 3000, assistencia: 500, funcionamento: 2000 },
  matriz: 1875091.31,
  matrizAnterior: 1568448.19,
  recebidoAnterior: 1946728.63,
  fracaoSapucaia: 0.33,
  turmas: { quantidade: 64, somaValor: 1875091.31, somaPerda: 23914.28, retidas: 10, valorRetidas: 47828.56 },
  turma: { curso: "INFORMATICA", alunos: 32, valor: 223148.59, peso: 1.5, chMatriz: 3000, valorMatricula: 1239.71 },
  outroCampus: { curso: "TECNICO EM INFORMATICA", valorAqui: 155427.9, campus: "PELOTAS", valor: 100 },
  ultimaTurma: { curso: "TECNICO EM INFORMATICA", termino: "2028-12-21T00:00:00.000Z" },
  ciclosDaQuartaFase: 1986,
  ifsul: { eficiencia: 0.4071, rap: 18.54 },
  arquivosImportados: 10,
  loa: { exercicio: 2026, valor: 100 },
  pnp: { anoBase: 2025, matriculas: 1000 },
  pnpOrcamento: { anoBase: 2025, empenhado: 100, acao: "20RL" },
  confianca: { conferidos: 3, atencao: 2, estimados: 1 },
  usuarios: 5,
  registrosDeAuditoria: 7,
};

describe("exemplos do Guia das telas", () => {
  it("toda ficha do guia tem exemplo quando os dados existem", () => {
    const exemplos = montarExemplos(completo);
    const enderecos = [...Object.keys(FICHAS_DAS_TELAS), ...TELAS_DE_ADMINISTRACAO.map((t) => t.href)];
    expect(enderecos.filter((h) => !exemplos[h])).toEqual([]);
  });

  it("as contas saem dos números reais", () => {
    // O formato de moeda usa espaço não separável depois de "R$".
    const e = Object.fromEntries(Object.entries(montarExemplos(completo)).map(([k, v]) => [k, v.replace(/ /g, " ")]));
    expect(e["/consulta/valor-do-aluno"]).toContain("R$ 6.973,39");
    // 1.946.728,63 + 33% × (1.875.091,31 − 1.946.728,63)
    expect(e["/simulador/distribuicao"]).toContain("R$ 1.923.088,31");
    expect(e["/consulta/curso"]).toContain("5,63 matrículas");
  });

  it("dado que falta tira o exemplo, sem inventar número", () => {
    const e = montarExemplos({ ...completo, matriz: null, turma: null, turmas: null });
    expect(e["/consulta"]).toBeUndefined();
    expect(e["/consulta/curso"]).toBeUndefined();
    expect(e["/evasao"]).toBeUndefined();
  });
});
