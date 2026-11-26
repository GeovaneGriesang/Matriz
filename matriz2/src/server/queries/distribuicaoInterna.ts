import { prisma } from "@/server/db/prisma";
import { ehInstituicaoDestaque } from "@/lib/destaque";

/**
 * A base da distribuição interna entre os câmpus (só o IFSul tem a regra cadastrada): o que cada câmpus recebeu no ano
 * anterior ao da matriz, o valor oficial do ano da matriz, quando já decidido, e a matriz de cada câmpus no ano.
 * A Reitoria fica de fora: a regra reparte só o Funcionamento dos câmpus.
 */
export async function dadosDaDistribuicaoInterna(instituicaoId: number, sigla: string, anoMatriz: number) {
  if (!ehInstituicaoDestaque(sigla)) return null;
  const [unidades, recebidos, matrizes] = await Promise.all([
    prisma.unidade.findMany({ where: { instituicaoId, tipo: "CAMPUS" }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    prisma.valorRecebidoCampus.findMany({ where: { ano: { in: [anoMatriz - 1, anoMatriz] }, unidade: { instituicaoId, tipo: "CAMPUS" } }, select: { ano: true, unidadeId: true, valorRecebido: true } }),
    prisma.distribuicaoCampus.findMany({ where: { ano: anoMatriz, unidade: { instituicaoId, tipo: "CAMPUS" } }, select: { unidadeId: true, vlMatrFinal: true } }),
  ]);
  const anterior: Record<string, number> = {};
  const oficial: Record<string, number> = {};
  for (const r of recebidos) (r.ano === anoMatriz ? oficial : anterior)[String(r.unidadeId)] = Number(r.valorRecebido);
  if (Object.keys(anterior).length === 0) return null;
  const matriz: Record<string, number> = {};
  for (const m of matrizes) matriz[String(m.unidadeId)] = Number(m.vlMatrFinal ?? 0);
  return { anoMatriz, campi: unidades, anterior, oficial: Object.keys(oficial).length > 0 ? oficial : null, matriz };
}

export type DadosDaDistribuicaoInternaServidor = NonNullable<Awaited<ReturnType<typeof dadosDaDistribuicaoInterna>>>;
