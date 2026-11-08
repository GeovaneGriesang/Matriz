/**
 * Grava o total de 2027 de cada câmpus do IFSul como valor informado (`ValorRecebidoCampus`), conforme a proposta oficial
 * da Reitoria: "Proposta de distribuição orçamentária, versão 01" (PDF apresentado no CODIR de 03 e 04/11/2026, em São
 * Leopoldo), pág. 6, coluna "Total proposto 2027 (R$)". Confirmado em 2026-11-08 que é a proposta oficial.
 *
 * São Leopoldo fica fora do rateio no documento e recebe à parte os R$ 700.000,00 do piso da MDO. A linha da Reitoria
 * (custeio, fomento e ações institucionais, R$ 9.940.689,89) não é gravada: não é Funcionamento de câmpus, e 2026 também
 * não tem a Reitoria informada.
 *
 * Uso: npx tsx scripts/carregarDistribuicao2027Ifsul.ts
 *
 * Nunca sobrescreve: o câmpus que já tem valor informado em 2027 fica como está e aparece na saída.
 */
import { prisma } from "../src/server/db/prisma";

const ANO = 2027;
const OBSERVACAO = "Proposta oficial da Reitoria para 2027 (Proposta de distribuição orçamentária, versão 01, CODIR de 03 e 04/11/2026), pág. 6, Total proposto 2027.";
const OBSERVACAO_SAO_LEOPOLDO = "Proposta oficial da Reitoria para 2027 (versão 01, CODIR de 03 e 04/11/2026): fora do rateio, recebe à parte o piso da MDO.";

const VALORES: Record<string, number> = {
  "CAMPUS BAGÉ": 2180644.29,
  "CAMPUS CAMAQUÃ": 1947281.85,
  "CAMPUS CHARQUEADAS": 2740569.11,
  "CAMPUS GRAVATAÍ": 1326758.57,
  "CAMPUS JAGUARÃO": 950000,
  "CAMPUS LAJEADO": 1314050.0,
  "CAMPUS NOVO HAMBURGO": 950000,
  "CAMPUS PASSO FUNDO": 2517199.58,
  "CAMPUS PELOTAS": 11291324.26,
  "CAMPUS PELOTAS VISCONDE DA GRAÇA": 5732549.42,
  "CAMPUS SANTANA DO LIVRAMENTO": 2585795.88,
  "CAMPUS SAPIRANGA": 1417090.19,
  "CAMPUS SAPUCAIA DO SUL": 3508364.34,
  "CAMPUS VENÂNCIO AIRES": 1946728.63,
  "CAMPUS SÃO LEOPOLDO": 700000,
};

async function main() {
  const soma = Object.entries(VALORES).reduce((s, [n, v]) => (n === "CAMPUS SÃO LEOPOLDO" ? s : s + v), 0);
  if (Math.abs(soma - 40408356.11) > 0.01) throw new Error(`A soma dos câmpus deveria ser 40.408.356,11 e deu ${soma}.`);

  const admin = await prisma.usuario.findFirst({ where: { papel: "SUPER_ADMIN" }, orderBy: { id: "asc" }, select: { id: true } });
  if (!admin) throw new Error("Nenhum super-admin para registrar como autor.");

  const unidades = await prisma.unidade.findMany({ where: { instituicao: { sigla: "IFSUL" } }, select: { id: true, nome: true } });
  const porNome = new Map(unidades.map((u) => [u.nome, u.id]));
  const faltando = Object.keys(VALORES).filter((n) => !porNome.has(n));
  if (faltando.length) throw new Error(`Unidades não encontradas: ${faltando.join(", ")}`);

  let gravados = 0;
  for (const [nome, valorRecebido] of Object.entries(VALORES)) {
    const unidadeId = porNome.get(nome)!;
    const existente = await prisma.valorRecebidoCampus.findUnique({ where: { ano_unidadeId: { ano: ANO, unidadeId } } });
    if (existente) {
      console.log(`mantido: ${nome} já tem ${Number(existente.valorRecebido)} (o documento diz ${valorRecebido})`);
      continue;
    }
    const observacao = nome === "CAMPUS SÃO LEOPOLDO" ? OBSERVACAO_SAO_LEOPOLDO : OBSERVACAO;
    await prisma.valorRecebidoCampus.create({ data: { ano: ANO, unidadeId, valorRecebido, observacao, registradoPorId: admin.id } });
    gravados++;
  }
  console.log(`${gravados} câmpus gravados em ${ANO}; ${Object.keys(VALORES).length - gravados} já existiam.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
