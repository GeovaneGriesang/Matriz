import { describe, expect, it } from "vitest";
import amostra from "../fixtures/quarta_fase_ddi_2025_amostra.json";
import {
  colunasDaQuartaFase,
  COLUNAS_QUARTA_FASE,
  contaDaColuna,
  matriculaTotalPeloMotor,
  valorDaColuna,
  type ChaveColuna,
  type EntradaQuartaFase,
} from "@/lib/mdo/quartaFase";

const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

type LinhaAmostra = (typeof amostra.linhas)[number];
function entrada(l: LinhaAmostra): EntradaQuartaFase {
  return {
    tipoCurso: l.tipoCurso,
    tipoOferta: l.tipoOferta,
    agropecuaria: l.agropecuaria,
    inicio: dia(l.inicio),
    termino: dia(l.termino),
    chCiclo: l.chCiclo,
    chMec: l.chMec,
    peso: l.peso,
    inicioPeriodo: dia(l.inicioPeriodo),
    fimPeriodo: dia(l.fimPeriodo),
    matriculas: l.matriculas,
  };
}

describe("planilha da 4ª fase, refeita coluna a coluna", () => {
  it("a amostra cobre os cinco DACP, agropecuária, retido jubilado, FIC, Proeja e integrado", () => {
    const casos = new Set(amostra.linhas.flatMap((l) => l.casos));
    for (const c of ["dacp1", "dacp2", "dacp3", "dacp4", "dacp5", "agro", "jubilado", "fic", "proeja", "integrado", "curto"]) expect(casos).toContain(c);
  });

  it.each(amostra.linhas.map((l) => [l.linha, l] as const))("linha %i: as 16 colunas iguais às que o Excel gravou na planilha da DDI", (_n, l) => {
    const c = colunasDaQuartaFase(entrada(l));
    const planilha = l.planilha as Record<ChaveColuna, number>;
    for (const col of COLUNAS_QUARTA_FASE) expect(valorDaColuna(c, col.chave), `${col.sigla}`).toBeCloseTo(planilha[col.chave], 9);
  });

  it.each(amostra.linhas.map((l) => [l.linha, l] as const))("linha %i: o motor do sistema dá a mesma Matrícula Total", (_n, l) => {
    expect(matriculaTotalPeloMotor(entrada(l))).toBeCloseTo((l.planilha as Record<ChaveColuna, number>).mt, 9);
  });

  it("no ano bissexto, as fórmulas e o motor continuam iguais (retido conta 183 dias; ciclo longo divide por 366)", () => {
    const base = entrada(amostra.linhas[0]!);
    const bissexto = { ...base, inicioPeriodo: dia("2024-01-01"), fimPeriodo: dia("2024-12-31") };
    const retido = { ...bissexto, inicio: dia("2019-02-01"), termino: dia("2022-12-20"), matriculas: 10 };
    const longo = { ...bissexto, inicio: dia("2023-02-01"), termino: dia("2026-12-20"), matriculas: 10 };
    expect(colunasDaQuartaFase(retido).dacp[4]).toBe(183);
    for (const e of [retido, longo]) expect(matriculaTotalPeloMotor(e)).toBeCloseTo(colunasDaQuartaFase(e).mt, 9);
  });

  it("escreve a conta com os números do ciclo", () => {
    const e: EntradaQuartaFase = {
      tipoCurso: "TECNICO",
      tipoOferta: "INTEGRADO",
      agropecuaria: false,
      inicio: dia("2018-02-07"),
      termino: dia("2021-12-23"),
      chCiclo: 3800,
      chMec: 1200,
      peso: 2.5,
      inicioPeriodo: dia("2023-01-01"),
      fimPeriodo: dia("2023-12-31"),
      matriculas: 6,
    };
    const c = colunasDaQuartaFase(e);
    expect(contaDaColuna("qdtc", e, c)).toBe("23/12/2021 − 07/02/2018 + 1 = 1.416 dias");
    expect(contaDaColuna("chm", e, c)).toBe("Integrado com mínima do MEC de 1.200 h: 3.200 h");
    expect(contaDaColuna("mechda", e, c)).toMatch(/^retido dentro do prazo: FECHDA × QTM ÷ 2/);
    expect(c.mt).toBeCloseTo(3.866525423728814, 12);
  });
});
