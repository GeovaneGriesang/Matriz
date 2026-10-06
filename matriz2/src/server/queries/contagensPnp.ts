import { prisma } from "@/server/db/prisma";

/**
 * Quantas linhas cada fonte tem nas duas tabelas gigantes da PNP (7 milhões e 2 milhões de linhas). Contá-las leva uns 5 segundos em produção
 * e muda só quando alguém roda uma carga, então o resultado fica em memória por 30 minutos. Só a primeira abertura de cada período espera.
 */

const VALIDADE_MS = 30 * 60_000;

interface Contagens {
  pnpFatos: Map<number, number>;
  pnpOrcamentoFatos: Map<number, number>;
}

let guardado: { em: number; dados: Contagens } | null = null;
let calculando: Promise<Contagens> | null = null;

async function calcular(): Promise<Contagens> {
  const [fatos, orcamento] = await Promise.all([
    prisma.pnpFato.groupBy({ by: ["fonteDadosId"], _count: { _all: true } }),
    prisma.pnpOrcamentoFato.groupBy({ by: ["fonteDadosId"], _count: { _all: true } }),
  ]);
  return {
    pnpFatos: new Map(fatos.map((g) => [g.fonteDadosId, g._count._all])),
    pnpOrcamentoFatos: new Map(orcamento.map((g) => [g.fonteDadosId, g._count._all])),
  };
}

export async function contagensPnpPorFonte(agora = Date.now()): Promise<Contagens> {
  if (guardado && agora - guardado.em < VALIDADE_MS) return guardado.dados;
  // Várias pessoas abrindo a tela ao mesmo tempo esperam a mesma contagem, em vez de dispararem uma cada.
  calculando ??= calcular().finally(() => {
    calculando = null;
  });
  const dados = await calculando;
  guardado = { em: agora, dados };
  return dados;
}
