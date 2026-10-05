import { prisma } from "@/server/db/prisma";

export interface TaxasEvasaoDaInstituicao {
  /** Fração anual (0 a 1) na modalidade presencial: evadidos ÷ matrículas, somados nos anos usados. */
  presencial: number;
  /** Idem, na educação a distância. */
  ead: number;
  /** Anos-base da PNP que entraram na média. */
  anos: number[];
  /** Taxa de cada ano, para mostrar de onde veio a média. */
  porAno: Array<{ anoBase: number; presencial: number | null; ead: number | null }>;
}

const ANOS_NA_MEDIA = 3;

function numero(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/**
 * A taxa anual de evasão da instituição por modalidade, da PNP (subaba "Taxa de Evasão Anual", aberta por modalidade de ensino).
 * É a média ponderada pelas matrículas dos últimos anos-base disponíveis: soma dos evadidos ÷ soma das matrículas, e não a média
 * das taxas, para um ano pequeno não pesar como um grande. Devolve null quando a PNP não tem o dado da instituição.
 */
export async function taxasDeEvasaoDaInstituicao(instituicaoId: number): Promise<TaxasEvasaoDaInstituicao | null> {
  const estrutura = await prisma.pnpEstrutura.findFirst({ where: { nivel: "INSTITUICAO", instituicaoId } });
  if (!estrutura) return null;
  const fatos = await prisma.pnpFato.findMany({
    where: { estruturaId: estrutura.id, subaba: "Taxa de Evasão Anual", dimensao: "Modalidade de Ensino" },
    select: { anoBase: true, valorDimensao: true, valores: true },
    orderBy: { anoBase: "desc" },
  });

  // A mesma linha pode vir de mais de uma edição da PNP: fica uma por ano e modalidade.
  const porChave = new Map<string, { anoBase: number; modalidade: "presencial" | "ead"; matriculas: number; evadidos: number }>();
  for (const f of fatos) {
    const modalidade = /dist/i.test(f.valorDimensao) ? "ead" : /presencial/i.test(f.valorDimensao) ? "presencial" : null;
    if (!modalidade) continue;
    const v = f.valores as Record<string, unknown>;
    const matriculas = numero(v["Número de Matrículas"]);
    const evadidos = numero(v["Matrículas | Número de Evadidos"]);
    const chave = `${f.anoBase}|${modalidade}`;
    if (!porChave.has(chave) && matriculas > 0) porChave.set(chave, { anoBase: f.anoBase, modalidade, matriculas, evadidos });
  }
  const anosDisponiveis = [...new Set([...porChave.values()].map((x) => x.anoBase))].sort((a, b) => b - a);
  const anos = anosDisponiveis.slice(0, ANOS_NA_MEDIA).sort((a, b) => a - b);
  if (anos.length === 0) return null;

  const soma = (modalidade: "presencial" | "ead") => {
    const linhas = [...porChave.values()].filter((x) => x.modalidade === modalidade && anos.includes(x.anoBase));
    const matriculas = linhas.reduce((s, x) => s + x.matriculas, 0);
    return matriculas > 0 ? linhas.reduce((s, x) => s + x.evadidos, 0) / matriculas : 0;
  };
  const taxaDoAno = (anoBase: number, modalidade: "presencial" | "ead") => {
    const x = porChave.get(`${anoBase}|${modalidade}`);
    return x && x.matriculas > 0 ? x.evadidos / x.matriculas : null;
  };
  return {
    presencial: soma("presencial"),
    ead: soma("ead"),
    anos,
    porAno: anos.map((a) => ({ anoBase: a, presencial: taxaDoAno(a, "presencial"), ead: taxaDoAno(a, "ead") })),
  };
}
