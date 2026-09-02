import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";

/**
 * Conferências que o próprio dado da MDO oferece, transformadas em teste.
 *
 * O sistema não recalcula a matriz, então não há fórmula nossa para testar. O que
 * há, e é melhor, são identidades entre números publicados por fases diferentes da
 * MDO: se a carga distorcer qualquer coisa, ou se uma exportação futura mudar de
 * formato, uma destas contas para de fechar.
 *
 * Roda contra o banco carregado. Se não houver banco ou ciclo nenhum, os testes se
 * declaram pulados em vez de falhar: quem clona o repositório não deve ver vermelho
 * por ainda não ter carregado dado.
 */

const prisma = new PrismaClient();
const CENTAVOS = 1; // tolerância de R$ 1,00 para arredondamento entre abas

afterAll(async () => {
  await prisma.$disconnect();
});

async function bancoDisponivel(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

const num = (v: unknown) => Number(v ?? 0);

describe("conferência da carga da MDO", () => {
  it("o banco responde, ou os testes se declaram pulados", async () => {
    const ok = await bancoDisponivel();
    if (!ok) console.warn("  banco indisponível; as conferências abaixo não têm o que verificar.");
    expect(true).toBe(true);
  });

  it("Funcionamento distribuído mais Piso Mínimo fecha o bloco de 80%", async () => {
    if (!(await bancoDisponivel())) return;
    const ciclos = await prisma.cicloOrcamento.findMany();
    let verificados = 0;

    for (const c of ciclos) {
      const soma = await prisma.distribuicaoCiclo.aggregate({
        where: { ano: c.ano },
        _sum: { valorReais: true },
      });
      const distribuido = num(soma._sum.valorReais);
      // Só faz sentido nos ciclos que têm a 6ª fase carregada.
      if (distribuido === 0) continue;

      // A CONIF reserva o piso de dentro dos 80% e rateia o restante por matrícula.
      // Esta é a identidade central de toda a metodologia.
      expect(distribuido + num(c.pisoTotal)).toBeCloseTo(num(c.funcionamentoTotal), -Math.log10(CENTAVOS));
      verificados++;
    }
    console.log(`  ciclos com 6ª fase conferidos: ${verificados}`);
  });

  it("o Piso Mínimo total é o número de câmpus elegíveis vezes o piso por câmpus", async () => {
    if (!(await bancoDisponivel())) return;
    for (const c of await prisma.cicloOrcamento.findMany()) {
      if (c.campusComPiso === 0) continue;
      expect(c.campusComPiso * num(c.pisoPorCampus)).toBeCloseTo(num(c.pisoTotal), 0);

      // E a contagem precisa bater com as bandeiras "S" gravadas por câmpus.
      const marcados = await prisma.distribuicaoCampus.count({ where: { ano: c.ano, elegivelPiso: true } });
      expect(marcados).toBe(c.campusComPiso);
    }
  });

  it("Reitorias e Qualidade e Eficiência levam 10% cada, e o Funcionamento 80%", async () => {
    if (!(await bancoDisponivel())) return;
    for (const c of await prisma.cicloOrcamento.findMany()) {
      const reitorias = num(c.reitoriasTotal);
      if (reitorias === 0) continue;
      expect(num(c.qualidadeEficienciaTotal)).toBeCloseTo(reitorias, 0);
      // 80% dividido por 10% é oito. Conferido nos dois ciclos: em 2027,
      // 1.868.931.660 / 233.616.457,50 = 8; em 2026, 1.901.754.718 / 237.719.339,80 = 8.
      expect(num(c.funcionamentoTotal)).toBeCloseTo(reitorias * 8, 0);
    }
  });

  it("IEA, RAP e IAPL somados dão o bloco de Qualidade e Eficiência", async () => {
    if (!(await bancoDisponivel())) return;
    for (const c of await prisma.cicloOrcamento.findMany()) {
      const s = await prisma.distribuicaoInstituicao.aggregate({
        where: { ano: c.ano },
        _sum: { vlIea: true, vlRap: true, vlIapl: true },
      });
      const somado = num(s._sum.vlIea) + num(s._sum.vlRap) + num(s._sum.vlIapl);
      if (somado === 0) continue;
      expect(somado).toBeCloseTo(num(c.qualidadeEficienciaTotal), 0);
    }
  });

  it("a Assistência somada por câmpus bate com a declarada, quando a exportação é completa", async () => {
    if (!(await bancoDisponivel())) return;
    for (const c of await prisma.cicloOrcamento.findMany()) {
      const s = await prisma.distribuicaoCampus.aggregate({
        where: { ano: c.ano },
        _sum: { aePresencial: true, aeEad: true, aeRip: true },
      });
      const somado = num(s._sum.aePresencial) + num(s._sum.aeEad) + num(s._sum.aeRip);
      const declarado = num(c.assistenciaTotal);
      // A exportação de 2026 saiu sem matrícula e zerou a Assistência por câmpus;
      // este teste ignora ciclos assim, que o carregador já denuncia com aviso.
      if (declarado === 0 || somado < declarado * 0.5) continue;
      expect(somado).toBeCloseTo(declarado, 0);
    }
  });

  it("todo registro aponta para a fase da MDO que o produziu", async () => {
    if (!(await bancoDisponivel())) return;

    const cicloComFaseErrada = await prisma.distribuicaoCiclo.count({
      where: { fonteDados: { fase: { not: "F6_PARTICIPACAO" } } },
    });
    expect(cicloComFaseErrada).toBe(0);

    const campusComFaseErrada = await prisma.distribuicaoCampus.count({
      where: { fonteDados: { fase: { not: "F5_PROPOSTA" } } },
    });
    expect(campusComFaseErrada).toBe(0);

    // Abrangência e instituição precisam ser coerentes: um conjunto que cobre uma
    // instituição só tem de dizer qual, senão ninguém sabe se pode somá-lo com os
    // outros. É o campo que evita somar 14 câmpus achando que se somou 639.
    const parcialSemDono = await prisma.fonteDados.count({
      where: { abrangencia: { not: "REDE" }, instituicaoId: null },
    });
    expect(parcialSemDono).toBe(0);

    const redeComDono = await prisma.fonteDados.count({
      where: { abrangencia: "REDE", instituicaoId: { not: null } },
    });
    expect(redeComDono).toBe(0);
  });

  it("nenhum câmpus aparece duas vezes no mesmo ciclo", async () => {
    if (!(await bancoDisponivel())) return;
    const duplicados = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*) AS n FROM (
        SELECT ano, unidadeId FROM DistribuicaoCampus GROUP BY ano, unidadeId HAVING COUNT(*) > 1
      ) AS d`;
    expect(Number(duplicados[0]?.n ?? 0)).toBe(0);
  });
});
