/**
 * Grava em "Valores recebidos" o valor de 2027 de cada câmpus do IFSul pela transição proposta ao Colégio de Dirigentes: a base de 2026
 * mais 33% da diferença até a matriz de 2027 (5ª fase). A observação leva a marca de proposta, e as telas avisam que não é dinheiro recebido.
 *
 * Rode depois de `scripts/carregarBase2026Ifsul.ts`. Uso: npx tsx scripts/carregarProposta2027Ifsul.ts
 *
 * Pode ser repetido: atualiza o que ele mesmo gravou (se a 5ª fase mudar) e nunca toca em valor digitado por alguém.
 */
import { prisma } from "../src/server/db/prisma";
import { transicaoDoCampus } from "../src/lib/mdo/transicaoCumulativa";
import { ehValorProposto, MARCA_VALOR_PROPOSTO } from "../src/lib/valorProposto";

const ANO = 2027;
const OBSERVACAO = `${MARCA_VALOR_PROPOSTO}: base de 2026 + 33% da diferença até a matriz de 2027 (5ª fase).`;

const centavos = (v: number) => Math.round(v * 100) / 100;

async function main() {
  const admin = await prisma.usuario.findFirst({ where: { papel: "SUPER_ADMIN" }, select: { id: true } });
  if (!admin) throw new Error("Nenhum super-admin para registrar como autor.");

  const instituicao = await prisma.instituicao.findUnique({ where: { sigla: "IFSUL" }, select: { id: true } });
  if (!instituicao) throw new Error("IFSUL não encontrado.");

  const [matrizes, bases, existentes] = await Promise.all([
    prisma.distribuicaoCampus.findMany({
      where: { ano: ANO, unidade: { instituicaoId: instituicao.id, tipo: "CAMPUS" } },
      select: { unidadeId: true, vlMatrFinal: true, unidade: { select: { nome: true } } },
    }),
    prisma.valorRecebidoCampus.findMany({ where: { ano: 2026, unidade: { instituicaoId: instituicao.id } } }),
    prisma.valorRecebidoCampus.findMany({ where: { ano: ANO, unidade: { instituicaoId: instituicao.id } } }),
  ]);
  if (bases.length === 0) throw new Error("Sem a base de 2026: rode antes scripts/carregarBase2026Ifsul.ts.");

  const basePorId = new Map(bases.map((b) => [b.unidadeId, Number(b.valorRecebido)]));
  const existentePorId = new Map(existentes.map((e) => [e.unidadeId, e]));

  let gravados = 0;
  let soma = 0;
  for (const m of matrizes) {
    const matriz = Number(m.vlMatrFinal);
    const base = basePorId.get(m.unidadeId) ?? 0;
    if (matriz <= 0 && base <= 0) continue;
    const valorRecebido = centavos(transicaoDoCampus(base, [matriz, matriz, matriz])[0]!.valor);
    const existente = existentePorId.get(m.unidadeId);
    if (existente && !ehValorProposto(existente.observacao)) {
      console.log(`mantido: ${m.unidade.nome} já tem ${Number(existente.valorRecebido)}, digitado por alguém`);
      soma += Number(existente.valorRecebido);
      continue;
    }
    await prisma.valorRecebidoCampus.upsert({
      where: { ano_unidadeId: { ano: ANO, unidadeId: m.unidadeId } },
      create: { ano: ANO, unidadeId: m.unidadeId, valorRecebido, observacao: OBSERVACAO, registradoPorId: admin.id },
      update: { valorRecebido, observacao: OBSERVACAO },
    });
    console.log(`${m.unidade.nome}: base ${base}, matriz ${matriz}, 2027 ${valorRecebido}`);
    soma += valorRecebido;
    gravados++;
  }
  console.log(`${gravados} câmpus gravados em ${ANO}; soma ${centavos(soma)}.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
