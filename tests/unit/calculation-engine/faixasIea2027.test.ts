import { describe, it, expect } from "vitest";
import { bucketizeIea } from "@/calculation-engine/qualidadeEficiencia/iea/bucketizeIea";
import { weightIea } from "@/calculation-engine/qualidadeEficiencia/iea/weightIea";

/**
 * Casos reais extraídos da planilha oficial do ciclo 2027 (aba INDICADORES): as 16 instituições,
 * das 42, cujo IEA cai em faixa DIFERENTE nas tabelas de 2026 e de 2027. O peso esperado é o que a
 * própria planilha aplicou, obtido dividindo "IEA Ponderado" por "Eficiência Acadêmica".
 *
 * Servem de trava: se alguém apontar o ciclo 2027 para a tabela de 2026, todos estes falham. Foi
 * exatamente esse o erro que o cadastro de 2027 corria o risco de cometer, já que a tela oferecia
 * apenas a tabela de 2026.
 */
const CASOS_2027: { sigla: string; iea: number; pesoOficial: number }[] = [
  { sigla: "IFAP", iea: 0.4397, pesoOficial: 0.5 },
  { sigla: "IFBA", iea: 0.4719, pesoOficial: 1.0 },
  { sigla: "IF GOIANO", iea: 0.5074, pesoOficial: 1.5 },
  { sigla: "IFMA", iea: 0.5389, pesoOficial: 1.5 },
  { sigla: "CEFET-MG", iea: 0.4216, pesoOficial: 0.5 },
  { sigla: "IF SUDESTE MG", iea: 0.5608, pesoOficial: 2.0 },
  { sigla: "IFSERTAOPB", iea: 0.4752, pesoOficial: 1.0 },
  { sigla: "IFPI", iea: 0.5378, pesoOficial: 1.5 },
  { sigla: "CEFET-RJ", iea: 0.4314, pesoOficial: 0.5 },
  { sigla: "IFF", iea: 0.524, pesoOficial: 1.5 },
  { sigla: "IFRN", iea: 0.5343, pesoOficial: 1.5 },
  { sigla: "IFRO", iea: 0.4811, pesoOficial: 1.0 },
  { sigla: "IFRR", iea: 0.5628, pesoOficial: 2.0 },
  { sigla: "IFRS", iea: 0.471, pesoOficial: 1.0 },
  { sigla: "IFS", iea: 0.4254, pesoOficial: 0.5 },
  { sigla: "IFSP", iea: 0.4866, pesoOficial: 1.0 },
];

describe("faixas de IEA do ciclo 2027", () => {
  it.each(CASOS_2027)(
    "$sigla (IEA $iea) recebe peso $pesoOficial, como na planilha oficial de 2027",
    ({ iea, pesoOficial }) => {
      expect(weightIea(bucketizeIea(iea, "PLANILHA_2027"), "PLANILHA_2027")).toBe(pesoOficial);
    },
  );

  it("a tabela de 2026 daria peso diferente em TODOS estes casos — não são intercambiáveis", () => {
    for (const { iea, pesoOficial } of CASOS_2027) {
      expect(weightIea(bucketizeIea(iea, "PLANILHA_2026"), "PLANILHA_2026")).not.toBe(pesoOficial);
    }
  });

  it("os limiares são 0,90x / 1,00x / 1,10x / 1,20x da média de rede de 2027 (49,0%)", () => {
    const media = 0.49;
    // Um valor logo abaixo e logo acima de cada limiar deve mudar de faixa.
    for (const fator of [0.9, 1.0, 1.1, 1.2]) {
      const limiar = Number((media * fator).toFixed(4));
      const abaixo = weightIea(bucketizeIea(limiar - 0.0001, "PLANILHA_2027"), "PLANILHA_2027");
      const acima = weightIea(bucketizeIea(limiar + 0.0001, "PLANILHA_2027"), "PLANILHA_2027");
      expect(acima).toBeGreaterThan(abaixo);
    }
  });
});
