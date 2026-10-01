import { prisma } from "@/server/db/prisma";

/**
 * Apaga as linhas de uma fonte de dados nas tabelas grandes da PNP, em faixas de `id`.
 *
 * Um `DELETE ... WHERE fonteDadosId = ? LIMIT n` repetido fica cada vez mais lento: as linhas já apagadas
 * continuam marcadas no índice até a limpeza do InnoDB, e cada nova passada precisa saltar por todas elas.
 * Como os `id` de uma fonte são contínuos (a carga grava uma fonte de cada vez), apagar por faixa de `id`
 * vai direto às linhas certas, sem varrer o que já saiu.
 */
const TABELAS = ["PnpFato", "PnpOrcamentoFato", "PnpExtratorFato", "PnpMicrodadoCiclo", "PnpMicrodadoFinanceiro", "PnpMicrodadoServidor"] as const;
export type TabelaPnp = (typeof TABELAS)[number];

const PASSO = BigInt(20_000);

export async function apagarFatosDaFonte(tabela: TabelaPnp, fonteDadosId: number): Promise<void> {
  if (!TABELAS.includes(tabela)) throw new Error(`Tabela não permitida: ${tabela}`);
  // O nome da tabela vem da lista fixa acima, nunca de entrada externa.
  const faixa = await prisma.$queryRawUnsafe<{ minimo: bigint | null; maximo: bigint | null }[]>(
    `SELECT MIN(id) AS minimo, MAX(id) AS maximo FROM \`${tabela}\` WHERE fonteDadosId = ${Number(fonteDadosId)}`,
  );
  const minimo = faixa[0]?.minimo;
  const maximo = faixa[0]?.maximo;
  if (minimo === null || minimo === undefined || maximo === null || maximo === undefined) return;
  for (let de = BigInt(minimo); de <= BigInt(maximo); de += PASSO) {
    await prisma.$executeRawUnsafe(
      `DELETE FROM \`${tabela}\` WHERE id >= ${de} AND id < ${de + PASSO} AND fonteDadosId = ${Number(fonteDadosId)}`,
    );
  }
}
