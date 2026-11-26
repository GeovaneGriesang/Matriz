import { describe, expect, it } from "vitest";
import { lerEspelhoEmendas, lerRecibos } from "@/carga/lerEspelhoEmendas";

// Trecho no formato do texto de "Espelho - Emendas de Despesa" (pdftotext -raw): duas emendas, a segunda com a justificativa
// continuando na página seguinte, e o rodapé do autor em cada página.
const CABECALHO = ["Congresso Nacional", "Comissão Mista de Planos, Orçamentos Públicos e Fiscalização", "Lexor - Sistemas de Leis Orçamentárias", "PLN 24/2026 - Projeto de Lei Orçamentária Anual para 2027", "Avulso de Emendas"];
const AUTOR = ["AUTOR DA EMENDA", "Deputado Federal", "TIPO AUTOR", "4313 - Beto Preto"];

function emenda(numero: string, acrescimos: string[], total: string, justificativa: string[]): string[] {
  return [
    ...CABECALHO,
    "EMENDA",
    numero,
    "TIPO AUTOR",
    "Individual",
    "RP6 - IFPR - 20RL - Funcionamento",
    "EMENTA",
    "MODALIDADE DE EMENDA",
    "Individual",
    "ÓRGÃO ORÇAMENTÁRIO",
    "26000 - Ministério da Educação",
    "UNIDADE ORÇAMENTÁRIA",
    "26432 - Instituto Federal do Paraná",
    "FUNCIONAL PROGRAMÁTICA 12.363.5112.20RL.0041",
    "SUBTÍTULO",
    "0041 - No Estado do Paraná",
    "LOCALIDADE BENEFICIADA",
    "4100000 - Paraná",
    "20RL - Funcionamento das Instituições da Rede Federal de Educação Profissional, Científica e",
    "Tecnológica",
    "AÇÃO",
    "ACRÉSCIMOS À PROGRAMAÇÃO",
    "em R$ 1,00",
    "GND MODALIDADE DE APLICAÇÃO RP ACRÉSCIMO",
    ...acrescimos,
    `TOTAL: ${total}`,
    "CANCELAMENTOS COMPENSATÓRIOS em R$ 1,00",
    "1000 0 2 999",
    `TOTAL: ${total}`,
    "JUSTIFICATIVA",
    ...justificativa,
    ...AUTOR,
  ];
}

const texto = [
  ...emenda("43130005", ["Outras Despesas Correntes Aplicações Diretas 6 600.000", "3 90", "Investimentos Aplicações Diretas 6 1.500.000", "4 90"], "2.100.000", ["Fortalecer o IFPR."]),
  ...emenda("43130006", ["Investimentos Aplicações Diretas 6 10", "4 90"], "10", ["Primeira parte."]),
  ...CABECALHO,
  "JUSTIFICATIVA",
  "Segunda parte.",
  ...AUTOR,
].join("\n");

describe("lerEspelhoEmendas", () => {
  const emendas = lerEspelhoEmendas(texto);

  it("separa as emendas pelo número e junta as páginas de continuação", () => {
    expect(emendas.map((e) => e.numero)).toEqual(["43130005", "43130006"]);
    expect(emendas[1]!.justificativa).toBe("Primeira parte. Segunda parte.");
  });

  it("lê unidade, ação pela funcional, subtítulo e autor", () => {
    const e = emendas[0]!;
    expect(e.uoCodigo).toBe("26432");
    expect(e.uoNome).toBe("Instituto Federal do Paraná");
    expect(e.acao).toBe("20RL");
    expect(e.acaoDescricao).toBe("Funcionamento das Instituições da Rede Federal de Educação Profissional, Científica e Tecnológica");
    expect(e.subtitulo).toBe("0041 - No Estado do Paraná");
    expect(e.autor).toBe("Beto Preto");
    expect(e.tipoAutor).toBe("Deputado Federal");
    expect(e.modalidade).toBe("Individual");
  });

  it("separa os acréscimos por GND e fecha com o total", () => {
    const e = emendas[0]!;
    expect(e.acrescimos).toEqual([
      { gnd: 3, modalidadeAplicacao: "90", valor: 600000 },
      { gnd: 4, modalidadeAplicacao: "90", valor: 1500000 },
    ]);
    expect(e.total).toBe(2100000);
  });
});

describe("lerRecibos", () => {
  it("pega os números de 8 dígitos no início da linha", () => {
    const r = lerRecibos("NÚMERO AÇÃO\n28620009 Funcionamento das Instituições\n1.250.000\n26436 Rio Grande do Sul\n");
    expect([...r]).toEqual(["28620009"]);
  });
});
