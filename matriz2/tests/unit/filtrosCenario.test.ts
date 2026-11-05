import { describe, expect, it } from "vitest";
import {
  FILTROS_PRESENCIAIS_REGULARES,
  FILTROS_TODOS,
  filtroAtivo,
  grupoDaOferta,
  grupoDoFinanciamento,
  grupoDoTipoDeCurso,
  normalizarFiltros,
  passaNoFiltro,
  valorNaMedida,
} from "@/lib/filtrosCenario";
import { chaveDoFatorEsforco, fatorEsforcoPadrao, fatorMatriculaEquivalente } from "@/lib/mdo/matriculaEquivalente";
import { projetarMatriculados, turmasDeCursoNovo, type CicloProjetavel, type Premissas } from "@/lib/mdo/projecaoCiclos";

const turma = (m: Partial<Parameters<typeof passaNoFiltro>[0]> = {}) => ({
  repasse: "PRESENCIAL",
  tipoCurso: "TECNICO",
  tipoOferta: "INTEGRADO",
  fonteFinanciamento: "SEM PROGRAMA ASSOCIADO",
  retida: false,
  ...m,
});

describe("filtros de Cenários", () => {
  it("agrupa os tipos de curso que existem na MDO", () => {
    expect(["TECNICO", "ESPECIALIZACAO TECNICA"].map((t) => grupoDoTipoDeCurso(t))).toEqual(["TECNICO", "TECNICO"]);
    expect(["BACHARELADO", "LICENCIATURA", "TECNOLOGIA", "ABI"].map((t) => grupoDoTipoDeCurso(t))).toEqual(Array(4).fill("GRADUACAO"));
    expect(["ESPECIALIZACAO (LATO SENSU)", "MESTRADO", "MESTRADO PROFISSIONAL", "DOUTORADO"].map((t) => grupoDoTipoDeCurso(t))).toEqual(Array(4).fill("POS"));
    expect(grupoDoTipoDeCurso("QUALIFICACAO PROFISSIONAL (FIC)")).toBe("FIC");
    expect(["ENSINO MEDIO", "ENSINO FUNDAMENTAL I", "EDUCACAO INFANTIL"].map((t) => grupoDoTipoDeCurso(t))).toEqual(Array(3).fill("BASICA"));
  });

  it("agrupa a oferta e o financiamento", () => {
    expect(["PROEJA - INTEGRADO", "PROEJA - CONCOMITANTE"].map(grupoDaOferta)).toEqual(["PROEJA", "PROEJA"]);
    expect(grupoDaOferta("NÃO SE APLICA")).toBe("NAO_SE_APLICA");
    expect(grupoDoFinanciamento("SEM PROGRAMA ASSOCIADO")).toBe("SEM_PROGRAMA");
    expect(grupoDoFinanciamento("MOOC - APRENDA MAIS")).toBe("COM_PROGRAMA");
  });

  it("sem filtro, toda turma passa", () => {
    expect(filtroAtivo(FILTROS_TODOS)).toBe(false);
    expect(passaNoFiltro(turma({ repasse: "EAD_MOOC", tipoCurso: "QUALIFICACAO PROFISSIONAL (FIC)", retida: true }), FILTROS_TODOS)).toBe(true);
  });

  it("a qualificação no Proeja tem grupo próprio, separado do FIC comum", () => {
    expect(grupoDoTipoDeCurso("QUALIFICACAO PROFISSIONAL (FIC)", "PROEJA - CONCOMITANTE")).toBe("FIC_EJA");
    expect(grupoDoTipoDeCurso("QUALIFICACAO PROFISSIONAL (FIC)", "CONCOMITANTE")).toBe("FIC");
  });

  it("presenciais e regulares seguem a definição do usuário: só o FIC comum e o EAD ficam de fora", () => {
    const f = FILTROS_PRESENCIAIS_REGULARES;
    expect(filtroAtivo(f)).toBe(true);
    expect(passaNoFiltro(turma(), f)).toBe(true);
    expect(passaNoFiltro(turma({ tipoCurso: "BACHARELADO", tipoOferta: "NÃO SE APLICA" }), f)).toBe(true);
    expect(passaNoFiltro(turma({ tipoCurso: "MESTRADO", tipoOferta: "NÃO SE APLICA" }), f)).toBe(true);
    expect(passaNoFiltro(turma({ tipoCurso: "QUALIFICACAO PROFISSIONAL (FIC)" }), f)).toBe(false);
    expect(passaNoFiltro(turma({ repasse: "EAD_FP" }), f)).toBe(false);
    for (const tipoOferta of ["INTEGRADO", "CONCOMITANTE", "SUBSEQUENTE", "PROEJA - INTEGRADO"]) expect(passaNoFiltro(turma({ tipoOferta }), f)).toBe(true);
    expect(passaNoFiltro(turma({ tipoCurso: "QUALIFICACAO PROFISSIONAL (FIC)", tipoOferta: "PROEJA - CONCOMITANTE" }), f)).toBe(true);
    expect(passaNoFiltro(turma({ tipoCurso: "QUALIFICACAO PROFISSIONAL (FIC)", tipoOferta: "CONCOMITANTE" }), f)).toBe(false);
    expect(passaNoFiltro(turma({ tipoCurso: "ENSINO MEDIO", tipoOferta: "NÃO SE APLICA" }), f)).toBe(true);
  });

  it("a situação separa a turma em andamento da turma encerrada com retidos", () => {
    const f = { ...FILTROS_TODOS, situacao: ["EM_DIA"] };
    expect(passaNoFiltro(turma(), f)).toBe(true);
    expect(passaNoFiltro(turma({ retida: true }), f)).toBe(false);
  });

  it("cenário salvo sem filtros vale para todas as turmas, e valor estranho é ignorado", () => {
    expect(normalizarFiltros(undefined)).toEqual(FILTROS_TODOS);
    const n = normalizarFiltros({ modalidade: ["PRESENCIAL", "INVENTADA"], tipo: "quebrado" });
    expect(n.modalidade).toEqual(["PRESENCIAL"]);
    expect(n.tipo).toEqual(FILTROS_TODOS.tipo);
  });
});

describe("matrícula equivalente (Portaria Setec 146/2021)", () => {
  it("fora do FIC vale só o fec, sem importar a carga horária", () => {
    expect(fatorMatriculaEquivalente({ tipoCurso: "TECNICO", fatorEsforco: 1.02, cargaHoraria: 3200 })).toBeCloseTo(1.02);
    expect(fatorMatriculaEquivalente({ tipoCurso: "BACHARELADO", fatorEsforco: 1.037, cargaHoraria: 4000 })).toBeCloseTo(1.037);
  });

  it("no FIC, entra a carga horária do curso ÷ 800", () => {
    expect(fatorMatriculaEquivalente({ tipoCurso: "QUALIFICACAO PROFISSIONAL (FIC)", fatorEsforco: 1.1, cargaHoraria: 40 })).toBeCloseTo(0.055);
    expect(fatorMatriculaEquivalente({ tipoCurso: "QUALIFICACAO PROFISSIONAL (FIC)", fatorEsforco: 1.1, cargaHoraria: 160 })).toBeCloseTo(0.22);
  });

  it("o fec padrão é o do Anexo II para FIC, e 1 para os demais", () => {
    expect(fatorEsforcoPadrao("QUALIFICACAO PROFISSIONAL (FIC)")).toBe(1.1);
    expect(fatorEsforcoPadrao("MESTRADO")).toBe(1);
  });

  it("a chave do curso ignora acento e caixa, para casar a PNP com a MDO", () => {
    expect(chaveDoFatorEsforco("Técnico", "Técnico em Informática")).toBe(chaveDoFatorEsforco("TECNICO", "TECNICO EM INFORMATICA"));
  });
});

describe("as quatro medidas de um ponto da projeção", () => {
  const ponto = { valor: 1000, alunos: 10, alunosContados: 5 };
  it("cada medida lê o seu número", () => {
    expect(valorNaMedida("reais", ponto, 1.1)).toBe(1000);
    expect(valorNaMedida("alunos", ponto, 1.1)).toBe(10);
    expect(valorNaMedida("contados", ponto, 1.1)).toBe(5);
    expect(valorNaMedida("mateq", ponto, 1.1)).toBeCloseTo(11);
  });
});

describe("alunos matriculados na projeção", () => {
  const premissas: Premissas = { evasao: { presencial: 0, ead: 0 }, retencao: [0.5, 0.2, 0.1] };
  const data = (a: number, m = 12, d = 20) => new Date(Date.UTC(a, m - 1, d));
  const ciclo: CicloProjetavel = {
    id: 1,
    unidadeId: 1,
    curso: "C",
    tipoCurso: "TECNICO",
    tipoOferta: "INTEGRADO",
    repasse: "PRESENCIAL",
    inicio: data(2023, 3, 1),
    termino: data(2025),
    jubilamento: data(2028),
    chCiclo: 3200,
    chMec: 3200,
    chMatriz: 3200,
    peso: 1,
    agropecuaria: false,
    alunos: 40,
    valorPorMT: 100,
  };

  it("o retido conta inteiro nos matriculados e pela metade no que a MDO conta", () => {
    const p = projetarMatriculados(ciclo, 2025, 3, premissas);
    expect(p[0]!.alunos).toBe(40);
    expect(p[0]!.alunosContados).toBe(40);
    expect(p[1]!.alunos).toBe(20);
    expect(p[1]!.alunosContados).toBe(10);
  });

  it("depois do jubilamento, sai das duas contagens", () => {
    const p = projetarMatriculados({ ...ciclo, jubilamento: data(2026) }, 2025, 3, premissas);
    expect(p[2]!.alunos).toBe(0);
    expect(p[2]!.alunosContados).toBe(0);
  });

  it("no primeiro ano fica a matrícula publicada, mesmo de quem já passou do jubilamento", () => {
    const p = projetarMatriculados({ ...ciclo, inicio: data(2015, 3, 1), termino: data(2018), jubilamento: data(2021) }, 2025, 2, premissas);
    expect(p[0]!.alunos).toBe(40);
    expect(p[0]!.alunosContados).toBe(0);
    expect(p[1]!.alunos).toBe(0);
  });

  it("o curso novo também conta matrículas", () => {
    const turmas = turmasDeCursoNovo(
      { tipoCurso: "TECNICO", repasse: "PRESENCIAL", peso: 1, chMatriz: 3200, valorPorMT: 100, primeiroAnoEntrada: 2026, ultimoAnoEntrada: 2026, mesInicio: 3, ingressantes: 32, duracaoAnos: 4 },
      2025,
      3,
      premissas,
    );
    expect(turmas[0]!.pontos[0]!.alunos).toBe(0);
    expect(turmas[0]!.pontos[1]!.alunos).toBe(32);
  });
});
