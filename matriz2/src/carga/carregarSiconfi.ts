import { prisma } from "@/server/db/prisma";
import { ANEXO_BALANCO, ANEXO_FUNCAO, ENTES, linhasDoRreo, type Ente, type ItemSiconfi } from "@/lib/orcamento/siconfi";

/**
 * Carrega, da API de dados abertos do Tesouro Nacional (Siconfi), o RREO do Estado do RS e do município de Venâncio Aires: o último
 * bimestre entregue de cada ano. Pode ser repetido: apaga e regrava o ano do ente, e só troca quando o Tesouro já tem um bimestre
 * mais novo ou igual ao gravado.
 */
const API = "https://apidatalake.tesouro.gov.br/ords/siconfi/tt/rreo";

async function baixar(url: string): Promise<{ items: ItemSiconfi[]; hasMore?: boolean }> {
  let ultimoErro: unknown;
  for (let tentativa = 1; tentativa <= 4; tentativa++) {
    try {
      const r = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(90_000) });
      if (r.ok) return (await r.json()) as { items: ItemSiconfi[]; hasMore?: boolean };
      ultimoErro = new Error(`HTTP ${r.status}`);
    } catch (e) {
      ultimoErro = e;
    }
    await new Promise((ok) => setTimeout(ok, 3000 * tentativa));
  }
  throw ultimoErro instanceof Error ? ultimoErro : new Error(String(ultimoErro));
}

async function itensDoAnexo(ente: Ente, exercicio: number, periodo: number, anexo: string): Promise<ItemSiconfi[]> {
  const itens: ItemSiconfi[] = [];
  // A API devolve até 5.000 itens por página; o Anexo 02 do Estado tem cerca de 1.800.
  for (let offset = 0; ; offset += 5000) {
    const url = `${API}?an_exercicio=${exercicio}&nr_periodo=${periodo}&co_tipo_demonstrativo=RREO&no_anexo=${encodeURIComponent(anexo)}&id_ente=${ENTES[ente].codIbge}&offset=${offset}`;
    const j = await baixar(url);
    itens.push(...j.items);
    if (!j.hasMore || j.items.length === 0) break;
  }
  return itens;
}

export interface ResultadoSiconfi {
  ente: Ente;
  exercicio: number;
  periodo: number | null;
  linhas: number;
  despesaEmpenhada?: number;
  receitaRealizada?: number;
}

/** O último bimestre que o Tesouro já publicou para o ente no ano, procurando do 6º para o 1º. */
export async function ultimoBimestrePublicado(ente: Ente, exercicio: number): Promise<number | null> {
  for (let p = 6; p >= 1; p--) {
    const j = await baixar(`${API}?an_exercicio=${exercicio}&nr_periodo=${p}&co_tipo_demonstrativo=RREO&no_anexo=${encodeURIComponent(ANEXO_BALANCO)}&id_ente=${ENTES[ente].codIbge}`);
    if (j.items.length > 0) return p;
  }
  return null;
}

export async function carregarSiconfi(ente: Ente, exercicio: number): Promise<ResultadoSiconfi> {
  const periodo = await ultimoBimestrePublicado(ente, exercicio);
  if (periodo === null) return { ente, exercicio, periodo: null, linhas: 0 };
  const itens = [...(await itensDoAnexo(ente, exercicio, periodo, ANEXO_BALANCO)), ...(await itensDoAnexo(ente, exercicio, periodo, ANEXO_FUNCAO))];
  const linhas = linhasDoRreo(itens);
  const fonte = `Tesouro Nacional, Siconfi, RREO do ${periodo}º bimestre de ${exercicio}, ${ENTES[ente].nome}`;
  await prisma.$transaction([
    prisma.contaSiconfi.deleteMany({ where: { ente, exercicio } }),
    prisma.contaSiconfi.createMany({
      data: linhas.map((l) => ({ ente, codIbge: ENTES[ente].codIbge, exercicio, periodo, ...l, conta: l.conta.slice(0, 300), codConta: l.codConta.slice(0, 150), fonte })),
    }),
  ]);
  // A primeira linha de cada quadro é o total (despesas ou receitas, sem as intraorçamentárias).
  const total = (anexo: string, coluna: string, nivel: string) => linhas.find((l) => l.anexo === anexo && l.coluna === coluna && l.nivel === nivel)?.valor;
  return {
    ente,
    exercicio,
    periodo,
    linhas: linhas.length,
    despesaEmpenhada: total(ANEXO_FUNCAO, "empenhado", "total"),
    receitaRealizada: total(ANEXO_BALANCO, "realizado", "receita"),
  };
}
