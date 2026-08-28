import { describe, it, expect } from "vitest";
import {
  calcularMatriculaTotalEqualizadaPonderada,
  PESOS_MODALIDADE_PADRAO,
} from "@/calculation-engine/matriculaTotalEqualizada";
import { NotImplementedError } from "@/calculation-engine/errors/NotImplementedError";

const registro = {
  matriculaTotalPresencialEqualizada: 3249.16479,
  matriculaTotalEadEqualizada: 24.9507,
  matriculaTotalEadMoocEqualizada: 10,
  matriculaTotalEadFpEqualizada: 5,
};

describe("calcularMatriculaTotalEqualizadaPonderada", () => {
  it("aplica os pesos padrão por modalidade (Presencial 1 / EAD 0,25 / EAD MOOC 0,08 / EAD FP 0,8)", () => {
    const ponderada = calcularMatriculaTotalEqualizadaPonderada(registro);
    // denominador = Presencial*1 + EAD*0,25 + EAD FP*0,8 — EAD MOOC fica de fora.
    expect(ponderada.denominadorFuncionamento).toBeCloseTo(3249.16479 + 24.9507 * 0.25 + 5 * 0.8, 9);
    // adicional MOOC = EAD MOOC*0,08, somado depois (não dilui o MTP dos demais câmpus).
    expect(ponderada.moocAdicionalFuncionamento).toBeCloseTo(10 * 0.08, 9);
    // peso usado pelo Bloco Reitorias = denominador + adicional MOOC (MOOC entra normalmente aqui).
    expect(ponderada.pesoReitorias).toBeCloseTo(
      ponderada.denominadorFuncionamento + ponderada.moocAdicionalFuncionamento,
      9,
    );
  });

  /**
   * Até 28/08/2026 este teste afirmava `10 * 0,8` para o MOOC — ou seja, congelava o bug em vez de
   * pegá-lo. O peso correto é 0,08 (0,8 é o do EAD FP), conferido em `DADOS BASE!K41` das planilhas
   * oficiais de 2026 e 2027 e nas duas planilhas "Composição de Repasse". Este caso existe para que
   * uma volta acidental ao 0,8 falhe de imediato.
   */
  it("mantém o EAD MOOC dez vezes menor que o EAD FP — não são o mesmo peso", () => {
    expect(PESOS_MODALIDADE_PADRAO.eadMooc).toBe(0.08);
    expect(PESOS_MODALIDADE_PADRAO.eadFp).toBe(0.8);
    expect(PESOS_MODALIDADE_PADRAO.eadFp).toBeCloseTo(PESOS_MODALIDADE_PADRAO.eadMooc * 10, 9);
  });

  it("usa os pesos recebidos por parâmetro em vez dos padrão (composição cadastrada por ano)", () => {
    const ponderada = calcularMatriculaTotalEqualizadaPonderada(registro, {
      presencial: 1,
      ead: 0.5,
      eadMooc: 0.2,
      eadFp: 0.9,
    });
    expect(ponderada.denominadorFuncionamento).toBeCloseTo(3249.16479 + 24.9507 * 0.5 + 5 * 0.9, 9);
    expect(ponderada.moocAdicionalFuncionamento).toBeCloseTo(10 * 0.2, 9);
  });

  it("lança NotImplementedError quando não existe registro para o câmpus/ano-base — não inventa um valor", () => {
    expect(() => calcularMatriculaTotalEqualizadaPonderada(undefined)).toThrow(NotImplementedError);
  });
});
