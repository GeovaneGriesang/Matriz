import { describe, expect, it } from "vitest";
import { IDS_DAS_RESPOSTAS_PRONTAS, respostaPronta } from "@/lib/chat/respostasProntas";

const r = (p: string, rota = "/como-funciona") => respostaPronta(p, rota, "Modelo Teste");

describe("respostasProntas: perguntas que devem casar", () => {
  const casos: Array<[string, string]> = [
    ["Quantos por cento do orçamento vai para o bloco Funcionamento?", "80%"],
    ["Quanto é a fatia da Reitoria?", "10%"],
    ["Quanto o bloco Qualidade e Eficiência recebe do orçamento?", "10%"],
    ["Quais são os blocos da matriz?", "quatro blocos"],
    ["Qual é o valor do Piso Mínimo para câmpus novos?", "700 mil"],
    ["Por quantos anos vale o Piso Mínimo de um câmpus novo?", "5 anos"],
    ["Quanto vale um aluno de curso MOOC em relação ao presencial?", "8%"],
    ["E a distância com financiamento externo, quanto vale?", "25%"],
    ["O que é o ICQA?", "0,5"],
    ["Por quanto tempo o aluno retido continua contando na matriz?", "3 anos"],
    ["A matriz de 2027 usa os dados da PNP de qual ano?", "2025"],
    ["A LOA tem valor por câmpus?", "Não."],
    ["O que é a ação 2994?", "assistência"],
    ["Qual o peso das licenciaturas?", "2,5"],
    ["O que é a Matrícula Total?", "800 horas"],
    ["O que é a matriz orçamentária?", "Portaria MEC 243/2026"],
    ["Qual a diferença entre ciclo de curso e ciclo orçamentário?", "dois sentidos"],
    ["O que significa a marca Estimado?", "hipótese"],
    ["Os alunos que passaram do prazo do curso ainda contam para a matriz?", "ICQA 0,5"],
    ["Quem calcula a matriz?", "IFTM"],
    ["Que IA você é?", "Modelo Teste"],
  ];
  for (const [pergunta, trecho] of casos) {
    it(pergunta, () => {
      expect(r(pergunta), pergunta).toContain(trecho);
    });
  }

  it("a ação 20RL e a 2994 juntas respondem as duas", () => {
    const t = r("O que são as ações 20RL e 2994?")!;
    expect(t).toContain("20RL");
    expect(t).toContain("2994");
  });

  it("'o que esta tela mostra' usa a descrição da tela aberta", () => {
    expect(r("O que esta tela mostra?", "/simulador/projecao")).toContain("Cinco anos à frente");
  });
});

describe("respostasProntas: perguntas que NÃO devem casar (vão ao modelo)", () => {
  const nao = [
    "Quanto o IFSul recebe no Funcionamento em 2027?",
    "Qual o valor do Funcionamento do Câmpus Venâncio Aires?",
    "Quanto a Reitoria do IFSul já gastou na ação 20RL?",
    "Qual o piso salarial dos professores?",
    "Qual é a capital da França?",
    "Quanto vale o curso de Informática no câmpus Pelotas?",
    "Explique a variação do IFSul entre 2026 e 2027",
    "",
  ];
  for (const pergunta of nao) {
    it(`"${pergunta}"`, () => {
      expect(r(pergunta), pergunta).toBeNull();
    });
  }

  it("texto muito longo não casa", () => {
    expect(r("piso ".repeat(80))).toBeNull();
  });
});

describe("respostasProntas: catálogo", () => {
  it("cada resposta pronta tem identificador único", () => {
    expect(new Set(IDS_DAS_RESPOSTAS_PRONTAS).size).toBe(IDS_DAS_RESPOSTAS_PRONTAS.length);
  });
});
