import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ANO = 2024;

async function criarBatchSeed(fileType: Parameters<typeof prisma.ingestionBatch.create>[0]["data"]["fileType"]) {
  return prisma.ingestionBatch.create({
    data: {
      status: "PERSISTED",
      originalFilename: "seed-data",
      fileType,
      checksum: `seed-checksum-${fileType}`,
      rowCount: 2,
      validationReport: { issues: [] },
      completedAt: new Date(),
    },
  });
}

/** Dados de exemplo (valores reais de amostras da PNP para o IFB) para o dev local funcionar sem upload manual. */
async function main() {
  const ifb = await prisma.instituicao.upsert({
    where: { sigla: "IFB" },
    create: {
      sigla: "IFB",
      nome: "Instituto Federal de Brasília",
      organizacaoAcademica: "Instituto Federal",
      regiao: "Centro-Oeste",
      uf: "DF",
      estado: "Distrito Federal",
    },
    update: {},
  });

  const campusBrasilia = await prisma.unidade.upsert({
    where: { instituicaoId_nome: { instituicaoId: ifb.id, nome: "Campus Brasília" } },
    create: { instituicaoId: ifb.id, nome: "Campus Brasília" },
    update: {},
  });

  const campusCeilandia = await prisma.unidade.upsert({
    where: { instituicaoId_nome: { instituicaoId: ifb.id, nome: "Campus Ceilândia" } },
    create: { instituicaoId: ifb.id, nome: "Campus Ceilândia" },
    update: {},
  });

  const dadosGeraisBatch = await criarBatchSeed("DADOS_GERAIS");
  await prisma.fatoIndicador.createMany({
    data: [
      {
        ingestionBatchId: dadosGeraisBatch.id,
        fileType: "DADOS_GERAIS",
        ano: ANO,
        instituicaoId: ifb.id,
        unidadeId: campusBrasilia.id,
        medida: "Matrícula Equivalente | Geral",
        valor: 552335.25,
      },
      {
        ingestionBatchId: dadosGeraisBatch.id,
        fileType: "DADOS_GERAIS",
        ano: ANO,
        instituicaoId: ifb.id,
        unidadeId: campusCeilandia.id,
        medida: "Matrícula Equivalente | Geral",
        valor: 168568.18,
      },
    ],
  });

  const eficienciaBatch = await criarBatchSeed("EFICIENCIA_ACADEMICA");
  await prisma.fatoIndicador.createMany({
    data: [
      {
        ingestionBatchId: eficienciaBatch.id,
        fileType: "EFICIENCIA_ACADEMICA",
        ano: ANO,
        instituicaoId: ifb.id,
        unidadeId: campusBrasilia.id,
        medida: "Eficiência Acadêmica | Índice de Eficiência Acadêmica %",
        valor: 36.07,
      },
      {
        ingestionBatchId: eficienciaBatch.id,
        fileType: "EFICIENCIA_ACADEMICA",
        ano: ANO,
        instituicaoId: ifb.id,
        unidadeId: campusCeilandia.id,
        medida: "Eficiência Acadêmica | Índice de Eficiência Acadêmica %",
        valor: 34.85,
      },
    ],
  });

  const rapBatch = await criarBatchSeed("RELACAO_ALUNO_PROFESSOR_RAP");
  await prisma.fatoIndicador.createMany({
    data: [
      {
        ingestionBatchId: rapBatch.id,
        fileType: "RELACAO_ALUNO_PROFESSOR_RAP",
        ano: ANO,
        instituicaoId: ifb.id,
        unidadeId: campusBrasilia.id,
        medida: "RAP | RAP",
        valor: 38.26,
      },
      {
        ingestionBatchId: rapBatch.id,
        fileType: "RELACAO_ALUNO_PROFESSOR_RAP",
        ano: ANO,
        instituicaoId: ifb.id,
        unidadeId: campusCeilandia.id,
        medida: "RAP | RAP",
        valor: 26.13,
      },
    ],
  });

  const percentuaisLegaisBatch = await criarBatchSeed("PERCENTUAIS_LEGAIS");
  await prisma.fatoIndicador.createMany({
    data: [
      {
        ingestionBatchId: percentuaisLegaisBatch.id,
        fileType: "PERCENTUAIS_LEGAIS",
        ano: ANO,
        instituicaoId: ifb.id,
        unidadeId: campusBrasilia.id,
        medida: "Matrícula Equivalente | Técnicos",
        valor: 250581.6,
      },
      {
        ingestionBatchId: percentuaisLegaisBatch.id,
        fileType: "PERCENTUAIS_LEGAIS",
        ano: ANO,
        instituicaoId: ifb.id,
        unidadeId: campusBrasilia.id,
        medida: "Matrícula Equivalente | Formação de Professores",
        valor: 59592.05,
      },
      {
        ingestionBatchId: percentuaisLegaisBatch.id,
        fileType: "PERCENTUAIS_LEGAIS",
        ano: ANO,
        instituicaoId: ifb.id,
        unidadeId: campusBrasilia.id,
        medida: "Matrícula Equivalente | Proeja",
        valor: 4000,
      },
      {
        ingestionBatchId: percentuaisLegaisBatch.id,
        fileType: "PERCENTUAIS_LEGAIS",
        ano: ANO,
        instituicaoId: ifb.id,
        unidadeId: campusCeilandia.id,
        medida: "Matrícula Equivalente | Técnicos",
        valor: 128915.1,
      },
      {
        ingestionBatchId: percentuaisLegaisBatch.id,
        fileType: "PERCENTUAIS_LEGAIS",
        ano: ANO,
        instituicaoId: ifb.id,
        unidadeId: campusCeilandia.id,
        medida: "Matrícula Equivalente | Formação de Professores",
        valor: 36700.4,
      },
    ],
  });

  console.log("Seed concluído: 1 instituição, 2 unidades, 4 batches, 11 fatos.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
