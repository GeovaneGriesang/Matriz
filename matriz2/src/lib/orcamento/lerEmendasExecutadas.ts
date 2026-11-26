import { dividirLinha } from "@/lib/pnp/csvPainel";
import { numeroDoPortal } from "@/lib/orcamento/lerDespesaPortal";

/**
 * A execução das emendas parlamentares numa instituição, a partir do arquivo mensal de despesas do Portal da Transparência:
 * cada linha traz a unidade gestora (o câmpus que gastou), a ação, o grupo de despesa e, quando a despesa veio de emenda,
 * o código e o autor dela. O código tem 12 dígitos: o ano do orçamento (4), o autor (4) e o número da emenda dele (4), o mesmo
 * número do espelho de emendas do Congresso (autor + número).
 */
export interface EmendaExecutada {
  /** Ano do lançamento (o mês do arquivo). */
  ano: number;
  codigoEmenda: string;
  /** Ano do orçamento da emenda (os 4 primeiros dígitos do código); difere do ano do lançamento em restos a pagar. */
  anoEmenda: number;
  /** Autor + número, como no espelho do Congresso (ex.: 19860006). */
  numeroNoEspelho: string;
  autor: string;
  ugCodigo: string;
  ugNome: string;
  uoCodigo: string;
  acao: string;
  acaoNome: string;
  gnd: string;
  empenhado: number;
  liquidado: number;
  pago: number;
  rapPago: number;
}

/** O código de emenda vale quando tem 12 dígitos e não é dos códigos "sem emenda" do Portal. */
export function codigoDeEmendaValido(codigo: string | undefined): boolean {
  return !!codigo && /^\d{12}$/.test(codigo) && !/^0+$/.test(codigo);
}

export function lerEmendasExecutadas(texto: string, ugs: ReadonlySet<string>): EmendaExecutada[] {
  const linhas = texto.split(/\r?\n/);
  const cab = dividirLinha(linhas[0] ?? "");
  const i = (nome: string, obrigatoria = true) => {
    const ix = cab.indexOf(nome);
    if (ix < 0 && obrigatoria) throw new Error(`Coluna "${nome}" não encontrada no arquivo de despesas do Portal da Transparência.`);
    return ix;
  };
  const col = {
    mes: i("Ano e mês do lançamento"),
    ug: i("Código Unidade Gestora"),
    ugNome: i("Nome Unidade Gestora"),
    uo: i("Código Unidade Orçamentária"),
    acao: i("Código Ação"),
    acaoNome: i("Nome Ação"),
    codigo: i("Código Autor Emenda"),
    autor: i("Nome Autor Emenda"),
    gnd: i("Código Grupo de Despesa"),
    empenhado: i("Valor Empenhado (R$)"),
    liquidado: i("Valor Liquidado (R$)"),
    pago: i("Valor Pago (R$)"),
    rapPago: i("Valor Restos a Pagar Pagos (R$)", false),
  };
  const soma = new Map<string, EmendaExecutada>();
  for (const linha of linhas.slice(1)) {
    if (!linha.trim()) continue;
    const c = dividirLinha(linha);
    const codigo = c[col.codigo]?.trim();
    if (!ugs.has(c[col.ug] ?? "") || !codigoDeEmendaValido(codigo)) continue;
    const ano = Number((c[col.mes] ?? "").split("/")[0]);
    if (!ano) continue;
    const chave = [ano, codigo, c[col.ug], c[col.uo], c[col.acao], c[col.gnd]].join("|");
    const e =
      soma.get(chave) ??
      ({
        ano,
        codigoEmenda: codigo!,
        anoEmenda: Number(codigo!.slice(0, 4)),
        numeroNoEspelho: codigo!.slice(4),
        autor: (c[col.autor] ?? "").trim(),
        ugCodigo: c[col.ug]!,
        ugNome: c[col.ugNome] ?? "",
        uoCodigo: c[col.uo] ?? "",
        acao: c[col.acao] ?? "",
        acaoNome: c[col.acaoNome] ?? "",
        gnd: c[col.gnd] ?? "",
        empenhado: 0,
        liquidado: 0,
        pago: 0,
        rapPago: 0,
      } satisfies EmendaExecutada);
    e.empenhado += numeroDoPortal(c[col.empenhado]);
    e.liquidado += numeroDoPortal(c[col.liquidado]);
    e.pago += numeroDoPortal(c[col.pago]);
    if (col.rapPago >= 0) e.rapPago += numeroDoPortal(c[col.rapPago]);
    soma.set(chave, e);
  }
  return [...soma.values()];
}
