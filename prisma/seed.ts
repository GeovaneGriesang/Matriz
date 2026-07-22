import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const ifsul = await prisma.autarquia.upsert({
    where: { sigla: "IFSUL" },
    create: { sigla: "IFSUL", nome: "Instituto Federal Sul-rio-grandense" },
    update: {},
  });

  const campusVenancioAires = await prisma.campus.upsert({
    where: { codigoPnp: "IFSUL-VA" },
    create: { codigoPnp: "IFSUL-VA", nome: "Câmpus Venâncio Aires", autarquiaId: ifsul.id },
    update: {},
  });

  const campusPelotas = await prisma.campus.upsert({
    where: { codigoPnp: "IFSUL-PEL" },
    create: { codigoPnp: "IFSUL-PEL", nome: "Câmpus Pelotas", autarquiaId: ifsul.id },
    update: {},
  });

  const cursoInformatica = await prisma.curso.upsert({
    where: { campusId_codigoPnp: { campusId: campusVenancioAires.id, codigoPnp: "TEC-INF" } },
    create: {
      campusId: campusVenancioAires.id,
      codigoPnp: "TEC-INF",
      nome: "Técnico em Informática Integrado",
      eixoTecnologico: "INFORMACAO_COMUNICACAO",
      nivel: "TECNICO_INTEGRADO",
      modalidade: "PRESENCIAL",
      cnctLabTier: 3,
    },
    update: {},
  });

  const cursoAgropecuaria = await prisma.curso.upsert({
    where: { campusId_codigoPnp: { campusId: campusPelotas.id, codigoPnp: "TEC-AGRO" } },
    create: {
      campusId: campusPelotas.id,
      codigoPnp: "TEC-AGRO",
      nome: "Técnico em Agropecuária Integrado",
      eixoTecnologico: "RECURSOS_NATURAIS",
      nivel: "TECNICO_INTEGRADO",
      modalidade: "PRESENCIAL",
      cnctLabTier: 4,
    },
    update: {},
  });

  const seedBatch = await prisma.ingestionBatch.create({
    data: {
      status: "PERSISTED",
      originalFilename: "seed-data",
      fileType: "SITUACAO_MATRICULA",
      checksum: "seed-checksum",
      rowCount: 2,
      validationReport: { issues: [] },
      completedAt: new Date(),
    },
  });

  await prisma.matricula.createMany({
    data: [
      {
        cursoId: cursoInformatica.id,
        ingestionBatchId: seedBatch.id,
        matriculaEquivalente: 40,
        situacao: "ATIVA",
        dataIngressoCiclo: new Date("2023-02-01T00:00:00Z"),
        dataReferencia: new Date("2024-12-01T00:00:00Z"),
      },
      {
        cursoId: cursoAgropecuaria.id,
        ingestionBatchId: seedBatch.id,
        matriculaEquivalente: 30,
        situacao: "ATIVA",
        dataIngressoCiclo: new Date("2023-02-01T00:00:00Z"),
        dataReferencia: new Date("2024-12-01T00:00:00Z"),
      },
    ],
  });

  await prisma.indicadorCampus.createMany({
    data: [
      {
        campusId: campusVenancioAires.id,
        ingestionBatchId: seedBatch.id,
        tipo: "IEA",
        valor: 0.75,
        referenciaAno: 2024,
      },
      {
        campusId: campusPelotas.id,
        ingestionBatchId: seedBatch.id,
        tipo: "IEA",
        valor: 0.4,
        referenciaAno: 2024,
      },
      {
        campusId: campusVenancioAires.id,
        ingestionBatchId: seedBatch.id,
        tipo: "IAPL_TECNICOS",
        valor: 40,
        referenciaAno: 2024,
      },
      {
        campusId: campusPelotas.id,
        ingestionBatchId: seedBatch.id,
        tipo: "IAPL_TECNICOS",
        valor: 30,
        referenciaAno: 2024,
      },
    ],
  });

  console.log("Seed concluído: 1 autarquia, 2 câmpus, 2 cursos, 2 matrículas, 4 indicadores.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
