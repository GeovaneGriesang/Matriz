/**
 * Retrato do que a 5ª fase (Completo proposta) e a 6ª fase dizem sobre o IFSul e sobre os parâmetros do ciclo, para comparar antes e
 * depois de recarregar a 5ª fase. Só lê.
 *
 * Uso: npx tsx scripts/_analise_5a_vs_6a.ts [ano]
 */
import { prisma } from "../src/server/db/prisma";

const reais = (v: unknown) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (v: unknown) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

async function main() {
  const ano = Number(process.argv[2] ?? 2027);
  const inst = await prisma.instituicao.findFirstOrThrow({ where: { sigla: "IFSUL" } });

  const ciclo = await prisma.cicloOrcamento.findUnique({ where: { ano } });
  console.log(`CicloOrcamento ${ano} (5ª fase): ajuste ${reais(ciclo?.ajuste)}, funcionamento ${reais(ciclo?.funcionamentoTotal)}, assistência ${reais(ciclo?.assistenciaTotal)}, valor ref ${reais(ciclo?.valorReferenciaSpo)}`);

  const dist = await prisma.distribuicaoInstituicao.findUnique({ where: { ano_instituicaoId: { ano, instituicaoId: inst.id } } });
  if (dist) console.log(`IFSul na 5ª fase (DistribuicaoInstituicao): Funcionamento ${reais(dist.vlMatr)}, matrícula equivalente ${num(dist.matrEquivalente)}`);

  const campi = await prisma.distribuicaoCampus.findMany({ where: { ano, unidade: { instituicaoId: inst.id } }, select: { vlMatrFinal: true, mtPresencial: true, mtEad: true, mtEadMooc: true, mtEadFp: true } });
  const mt = campi.reduce((s, c) => s + Number(c.mtPresencial ?? 0) + Number(c.mtEad ?? 0) + Number(c.mtEadMooc ?? 0) + Number(c.mtEadFp ?? 0), 0);
  console.log(`IFSul por câmpus (5ª fase): ${campi.length} câmpus, soma de Funcionamento final ${reais(campi.reduce((s, c) => s + Number(c.vlMatrFinal ?? 0), 0))}, matrícula equalizada somada ${num(mt)}`);

  const p6 = await prisma.parametrosParticipacao.findUnique({ where: { ano_instituicaoId: { ano, instituicaoId: inst.id } } });
  if (p6) {
    console.log(`Parâmetros da 6ª fase do IFSul: ajuste ${reais(p6.ajuste)}, orçamento ${reais(p6.valorOrcamento)}, matrículas presencial ${num(p6.matriculasPresencial)} (EAD ${num(p6.matriculasEad)}, MOOC ${num(p6.matriculasEadMooc)}, FP ${num(p6.matriculasEadFp)})`);
  }

  const ciclos = await prisma.distribuicaoCiclo.aggregate({ where: { ano, unidade: { instituicaoId: inst.id } }, _sum: { valorReais: true, matriculaTotal: true }, _count: true });
  console.log(`IFSul na 6ª fase (soma dos ciclos): ${ciclos._count} ciclos, valor ${reais(ciclos._sum.valorReais)}, matrícula total ${num(ciclos._sum.matriculaTotal)}`);

  const fontes = await prisma.fonteDados.findMany({ where: { cicloOrcamento: ano, fase: { in: ["F5_PROPOSTA", "F6_PARTICIPACAO"] } }, select: { fase: true, arquivo: true, geradoEm: true, carregadoEm: true }, orderBy: { id: "asc" } });
  for (const f of fontes) console.log(`  fonte ${f.fase}: ${f.arquivo} (gerado ${f.geradoEm?.toISOString().slice(0, 10) ?? "?"}, carregado ${f.carregadoEm.toISOString().slice(0, 16)})`);
  await prisma.$disconnect();
}

main();
