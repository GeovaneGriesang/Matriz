import { prisma } from "@/server/db/prisma";

/**
 * As opções dos filtros das telas da PNP ("Detalhar por" e "Relação do órgão"). Listá-las direto da tabela de fatos varre milhões de linhas
 * (17 segundos para uma tabela do painel de ensino em produção), então ficam guardadas em `PnpOpcaoFiltro`, preenchida na carga da PNP.
 * Se uma lista ainda não existe (carga antiga, ou tabela nova), ela é calculada uma vez, gravada e devolvida: só a primeira consulta espera.
 */

export type PainelPnp = "ENSINO" | "ORCAMENTO";

interface Chave {
  painel: PainelPnp;
  edicao: number;
  aba: string;
  subaba: string;
}

async function lerGuardadas(c: Chave, tipo: "dimensao" | "relacaoOrgao"): Promise<string[] | null> {
  const linhas = await prisma.pnpOpcaoFiltro.findMany({
    where: { painel: c.painel, edicao: c.edicao, aba: c.aba, subaba: c.subaba, tipo },
    select: { valor: true },
  });
  return linhas.length > 0 ? linhas.map((l) => l.valor) : null;
}

async function guardar(c: Chave, tipo: "dimensao" | "relacaoOrgao", valores: string[]): Promise<void> {
  // Um conjunto vazio ("sem aberturas") não é gravado: seria indistinguível de "ainda não calculado" e refaria a consulta lenta toda vez.
  if (valores.length === 0) return;
  await prisma.pnpOpcaoFiltro.createMany({
    data: valores.map((valor) => ({ painel: c.painel, edicao: c.edicao, aba: c.aba, subaba: c.subaba, tipo, valor })),
    skipDuplicates: true,
  });
}

const ordenar = (l: string[]) => [...l].sort((a, b) => a.localeCompare(b, "pt-BR"));

/** As aberturas ("Detalhar por") de uma tabela do painel de ensino e pessoal. A abertura vazia ("") é "sem detalhamento" e sempre existe. */
export async function dimensoesDoEnsino(edicao: number, subaba: string): Promise<string[]> {
  const c: Chave = { painel: "ENSINO", edicao, aba: "", subaba };
  const guardadas = await lerGuardadas(c, "dimensao");
  if (guardadas) return ordenar(guardadas);
  const calculadas = (await prisma.pnpFato.groupBy({ by: ["dimensao"], where: { subaba, fonteDados: { cicloOrcamento: edicao } } })).map((d) => d.dimensao);
  await guardar(c, "dimensao", calculadas);
  return ordenar(calculadas);
}

/** As aberturas e as "relações do órgão" de uma tabela do painel orçamentário. */
export async function opcoesDoOrcamento(edicao: number, aba: string, subaba: string): Promise<{ dimensoes: string[]; orgaos: string[] }> {
  const c: Chave = { painel: "ORCAMENTO", edicao, aba, subaba };
  let dimensoes = await lerGuardadas(c, "dimensao");
  let orgaos = await lerGuardadas(c, "relacaoOrgao");
  const where = { aba, subaba, fonteDados: { cicloOrcamento: edicao } };
  if (!dimensoes) {
    dimensoes = (await prisma.pnpOrcamentoFato.groupBy({ by: ["dimensao"], where })).map((d) => d.dimensao);
    await guardar(c, "dimensao", dimensoes);
  }
  if (!orgaos) {
    orgaos = (await prisma.pnpOrcamentoFato.groupBy({ by: ["relacaoOrgao"], where })).map((o) => o.relacaoOrgao).filter(Boolean);
    await guardar(c, "relacaoOrgao", orgaos);
  }
  return { dimensoes: ordenar(dimensoes), orgaos: ordenar(orgaos) };
}

/**
 * Apaga as opções de uma edição e as recalcula para todas as tabelas carregadas. Chamada ao fim da carga da PNP, para a tela já achar as
 * listas prontas. As consultas são lentas (uma varredura por tabela), por isso rodam na carga e não na tela.
 */
export async function recalcularOpcoesPnp(edicao: number, log: (m: string) => void = () => undefined): Promise<void> {
  await prisma.pnpOpcaoFiltro.deleteMany({ where: { edicao } });
  const fontes = await prisma.fonteDados.findMany({
    where: { origem: "PNP_MANUAL", cicloOrcamento: edicao, OR: [{ arquivo: { startsWith: "PNP Dados de " } }, { arquivo: { startsWith: "PNP Dados Orçamentários: " } }] },
    select: { arquivo: true },
  });
  for (const f of fontes) {
    const orcamento = f.arquivo.startsWith("PNP Dados Orçamentários: ");
    const rotulo = f.arquivo.replace(/^PNP Dados (de (Ensino|Pessoal)|Orçamentários): /, "").replace(/ \(\d+ arquivos?\)$/, "");
    const [aba, subaba] = rotulo.split(" / ");
    const inicio = Date.now();
    if (orcamento) await opcoesDoOrcamento(edicao, aba ?? "", subaba ?? rotulo);
    else await dimensoesDoEnsino(edicao, subaba ?? rotulo);
    log(`  opções de filtro: ${rotulo} (${((Date.now() - inicio) / 1000).toFixed(1)} s)`);
  }
}
