import { describe, expect, it } from "vitest";
import { codigoDeEmendaValido, lerEmendasExecutadas } from "@/lib/orcamento/lerEmendasExecutadas";

const CAB =
  '"Ano e mês do lançamento";"Código Unidade Gestora";"Nome Unidade Gestora";"Código Unidade Orçamentária";"Código Ação";"Nome Ação";"Código Autor Emenda";"Nome Autor Emenda";"Código Grupo de Despesa";"Valor Empenhado (R$)";"Valor Liquidado (R$)";"Valor Pago (R$)";"Valor Restos a Pagar Pagos (R$)"';
const linha = (ug: string, codigo: string, emp: string, pago: string, rap = "0,00") =>
  `"2026/09";"${ug}";"INST.FED.SUL-RIO-GRANDENSE/CAMPUS X";"26436";"20RL";"Funcionamento";"${codigo}";"PAULO PIMENTA";"3";"${emp}";"0,00";"${pago}";"${rap}"`;

describe("emendas executadas no Portal", () => {
  it("reconhece o código de emenda", () => {
    expect(codigoDeEmendaValido("202619860008")).toBe(true);
    expect(codigoDeEmendaValido("-1")).toBe(false);
    expect(codigoDeEmendaValido("")).toBe(false);
    expect(codigoDeEmendaValido("000000000000")).toBe(false);
  });

  it("soma por câmpus e emenda, só das UGs pedidas e só das linhas com emenda", () => {
    const texto = [CAB, linha("151964", "202619860008", "1.000,50", "200,00"), linha("151964", "202619860008", "10,00", "0,00", "5,00"), linha("158126", "-1", "999,00", "0,00"), linha("999999", "202619860008", "7,00", "7,00")].join("\n");
    const r = lerEmendasExecutadas(texto, new Set(["151964", "158126"]));
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ ano: 2026, anoEmenda: 2026, numeroNoEspelho: "19860008", ugCodigo: "151964", empenhado: 1010.5, pago: 200, rapPago: 5 });
  });
});
