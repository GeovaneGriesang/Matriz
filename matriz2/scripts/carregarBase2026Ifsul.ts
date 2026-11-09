/**
 * Grava o orçamento de 2026 de cada câmpus do IFSul como valor informado (`ValorRecebidoCampus`), a base da
 * proposta oficial da Reitoria para 2027.
 *
 * Fonte: "Reuniões da comissão/Proposta de distribuição/Proposta V. Aires.xlsx", aba "Planilha da 5ª fase", coluna F
 * ("Orçamento (R$)"), total R$ 40.404.916,70.
 * A outra cópia desta tabela ("2026/Reprodução da planilha.xlsx") repete em Camaquã o valor de Bagé (R$ 2.180.644,29) e
 * por isso soma R$ 40.638.279,14; não é a usada aqui.
 *
 * São Leopoldo (R$ 100.000,00, câmpus em implantação) e a Reitoria (R$ 9.940.083,30, custeio, fomento e ações institucionais)
 * vêm da proposta oficial da Reitoria para 2027 (versão 01, pág. 6, coluna "Recebido 2026"), pedido em
 * 2026-11-08. Ficam fora do rateio dos câmpus: o total do IFSul em 2026 é R$ 50.445.000,00.
 *
 * Uso: npx tsx scripts/carregarBase2026Ifsul.ts
 *
 * Nunca sobrescreve: o câmpus que já tem valor informado em 2026 fica como está e aparece na saída.
 */
import { prisma } from "../src/server/db/prisma";

const ANO = 2026;
const OBSERVACAO = "Orçamento 2026 do IFSul, planilha da comissão (Proposta V. Aires.xlsx, aba Planilha da 5ª fase).";

const VALORES: Record<string, number> = {
  "CAMPUS BAGÉ": 2180644.29,
  "CAMPUS CAMAQUÃ": 1947281.85,
  "CAMPUS CHARQUEADAS": 2740569.11,
  "CAMPUS GRAVATAÍ": 1326758.57,
  "CAMPUS JAGUARÃO": 793730.65,
  "CAMPUS LAJEADO": 1236867.78,
  "CAMPUS NOVO HAMBURGO": 716815.53,
  "CAMPUS PASSO FUNDO": 2517199.58,
  "CAMPUS PELOTAS": 12012047.09,
  "CAMPUS SANTANA DO LIVRAMENTO": 2010704.49,
  "CAMPUS SAPIRANGA": 1417090.19,
  "CAMPUS SAPUCAIA DO SUL": 3460022.11,
  "CAMPUS VENÂNCIO AIRES": 1946728.63,
  "CAMPUS PELOTAS VISCONDE DA GRAÇA": 6098456.83,
};

const FORA_DO_RATEIO: Record<string, { valor: number; observacao: string }> = {
  "CAMPUS SÃO LEOPOLDO": { valor: 100000, observacao: "Recebido 2026 segundo a proposta oficial da Reitoria (versão 01, CODIR de 03 e 04/11/2026), pág. 6: câmpus em implantação, fora do rateio." },
  REITORIA: { valor: 9940083.3, observacao: "Recebido 2026 segundo a proposta oficial da Reitoria (versão 01, CODIR de 03 e 04/11/2026), pág. 6: custeio da Reitoria, fomento a pesquisa, extensão, ensino e internacionalização, mostra, jogos, câmpus em implantação, auxílio aos câmpus e capacitação dos servidores." },
};

async function main() {
  const soma = Object.values(VALORES).reduce((s, v) => s + v, 0);
  if (Math.abs(soma - 40404916.7) > 0.01) throw new Error(`A soma da tabela deveria ser 40.404.916,70 e deu ${soma}.`);
  const total = soma + Object.values(FORA_DO_RATEIO).reduce((s, f) => s + f.valor, 0);
  if (Math.abs(total - 50445000) > 0.01) throw new Error(`O total do IFSul em 2026 deveria ser 50.445.000,00 e deu ${total}.`);

  const admin = await prisma.usuario.findFirst({ where: { papel: "SUPER_ADMIN" }, select: { id: true } });
  if (!admin) throw new Error("Nenhum super-admin para registrar como autor.");

  const unidades = await prisma.unidade.findMany({ where: { instituicao: { sigla: "IFSUL" } }, select: { id: true, nome: true } });
  const porNome = new Map(unidades.map((u) => [u.nome, u.id]));
  const faltando = [...Object.keys(VALORES), ...Object.keys(FORA_DO_RATEIO)].filter((n) => !porNome.has(n));
  if (faltando.length) throw new Error(`Unidades não encontradas: ${faltando.join(", ")}`);

  const linhas: [string, number, string][] = [
    ...Object.entries(VALORES).map(([nome, v]): [string, number, string] => [nome, v, OBSERVACAO]),
    ...Object.entries(FORA_DO_RATEIO).map(([nome, f]): [string, number, string] => [nome, f.valor, f.observacao]),
  ];
  let gravados = 0;
  for (const [nome, valorRecebido, observacao] of linhas) {
    const unidadeId = porNome.get(nome)!;
    const existente = await prisma.valorRecebidoCampus.findUnique({ where: { ano_unidadeId: { ano: ANO, unidadeId } } });
    if (existente) {
      console.log(`mantido: ${nome} já tem ${Number(existente.valorRecebido)} (a tabela diz ${valorRecebido})`);
      continue;
    }
    await prisma.valorRecebidoCampus.create({ data: { ano: ANO, unidadeId, valorRecebido, observacao, registradoPorId: admin.id } });
    gravados++;
  }
  console.log(`${gravados} unidades gravadas em ${ANO}; ${linhas.length - gravados} já existiam.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
