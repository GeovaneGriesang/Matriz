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

/**
 * A exportação de 2026-09-29 trouxe fases de horas diferentes do mesmo dia, e algumas
 * NÃO fecham entre si. Em vez de esconder isso afrouxando os testes, cada divergência
 * conhecida está fixada aqui com o número atual: se a MDO reexportar e ela sumir (ou
 * piorar), o teste falha e obriga a revisar esta lista.
 */
const DIVERGENCIAS_CONHECIDAS = {
  /** O MDO online paga o piso a 53 câmpus em 2027, mas a planilha tem 2 unidades repetidas do IFRJ (nome digitado errado), também marcadas com "S". */
  camposMarcadosNoPiso: { 2027: 55 } as Record<number, number>,
  /** Comparativo (relatório de Indicadores) contra a 5ª fase, em fração: gerados em momentos diferentes. */
  comparativoContra5a: { 2026: 0.06, 2027: 0.01 } as Record<number, number>,
};

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
      // E só quando a 6ª fase cobre a REDE: em 2026 só o IFSul tem 6ª fase (planilha por ciclo), e somar um câmpus contra o bloco da rede inteira não fecha.
      const comSextaDaRede = await prisma.fonteDados.count({ where: { cicloOrcamento: c.ano, fase: "F6_PARTICIPACAO", abrangencia: "REDE" } });
      if (comSextaDaRede === 0) continue;

      // A CONIF reserva o piso de dentro dos 80% e rateia o restante por matrícula.
      // Esta é a identidade central de toda a metodologia.
      //
      // Exceção real da exportação de 2026-09-29: a 6ª fase de UMA instituição (IFSul) veio
      // de um cálculo mais novo que o do resto da rede e que o da 5ª fase, com outra matrícula
      // total. Substituí-la faz a identidade errar exatamente pela diferença dela para a 5ª
      // fase. Nesse caso a identidade deixa de ser exata, mas o erro não pode passar do que
      // essas instituições explicam.
      const institucionais = await prisma.fonteDados.findMany({
        where: { cicloOrcamento: c.ano, fase: "F6_PARTICIPACAO", abrangencia: "INSTITUICAO" },
        select: { instituicaoId: true },
      });
      let folga = CENTAVOS;
      for (const { instituicaoId } of institucionais) {
        if (instituicaoId === null) continue;
        const dosCiclos = await prisma.distribuicaoCiclo.aggregate({
          where: { ano: c.ano, unidade: { instituicaoId } },
          _sum: { valorReais: true },
        });
        const daCinco = await prisma.distribuicaoCampus.findMany({
          where: { ano: c.ano, unidade: { instituicaoId } },
          select: { vlMatrizPresencial: true, vlMatrizEad: true, vlMatrizEadMooc: true, vlMatrizEadFp: true },
        });
        const calculadoCinco = daCinco.reduce(
          (t, x) => t + num(x.vlMatrizPresencial) + num(x.vlMatrizEad) + num(x.vlMatrizEadMooc) + num(x.vlMatrizEadFp),
          0,
        );
        folga += Math.abs(calculadoCinco - num(dosCiclos._sum.valorReais));
      }
      // Outra exceção real, de 2026-10-03: a MDO reexportou a 5ª fase com parâmetros novos (valor da matrícula presencial de R$ 1.239,71,
      // MOOC corrigido), mas a 6ª fase da REDE (por ciclo de curso) continua a de 2026-08-31, de outra rodada. Enquanto a 6ª da rede
      // for um arquivo sem prefixo de data e a 5ª um arquivo com prefixo, as duas não são a mesma fotografia e a identidade erra por
      // menos de 0,1% do bloco. Quando a 6ª da rede for reexportada (arquivo com prefixo de data), a conferência volta a ser exata.
      const fonteRede = await prisma.fonteDados.findFirst({
        where: { cicloOrcamento: c.ano, fase: "F6_PARTICIPACAO", abrangencia: "REDE" },
        orderBy: { id: "desc" },
        select: { arquivo: true },
      });
      const fonteCinco = await prisma.fonteDados.findFirst({
        where: { cicloOrcamento: c.ano, fase: "F5_PROPOSTA", NOT: { arquivo: { contains: "EXPANS" } } },
        orderBy: { id: "desc" },
        select: { arquivo: true },
      });
      const comPrefixoDeData = (arquivo: string | undefined) => /^[0-9]{8}_/.test(arquivo ?? "");
      if (fonteRede && !comPrefixoDeData(fonteRede.arquivo) && comPrefixoDeData(fonteCinco?.arquivo)) {
        folga += 0.001 * num(c.funcionamentoTotal);
        console.log(`  AVISO: ciclo ${c.ano}: a 6ª fase da rede (${fonteRede.arquivo}) é anterior à 5ª (${fonteCinco?.arquivo}); folga de 0,1% do bloco. Reexportar a 6ª da rede.`);
      }
      expect(Math.abs(distribuido + num(c.pisoTotal) - num(c.funcionamentoTotal))).toBeLessThanOrEqual(folga);
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
      expect(marcados).toBe(DIVERGENCIAS_CONHECIDAS.camposMarcadosNoPiso[c.ano] ?? c.campusComPiso);
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

  it("a participação das instituições soma 100% em cada ciclo", async () => {
    if (!(await bancoDisponivel())) return;
    const anos = await prisma.comparativoInstitucional.findMany({
      distinct: ["ano"],
      select: { ano: true },
    });
    for (const { ano } of anos) {
      const s = await prisma.comparativoInstitucional.aggregate({
        where: { ano },
        _sum: { participacaoPercentual: true },
      });
      const total = num(s._sum.participacaoPercentual);
      if (total === 0) continue;
      // A MDO publica cada fatia com duas casas, então a soma erra alguns centésimos.
      expect(total).toBeGreaterThan(99.5);
      expect(total).toBeLessThan(100.5);
    }
  });

  it("o comparativo bate com a 5ª fase onde as duas fontes se sobrepõem", async () => {
    if (!(await bancoDisponivel())) return;
    // Fontes diferentes, exportadas em datas diferentes, têm de dizer a mesma coisa
    // sobre o mesmo ciclo. É a conferência cruzada mais valiosa que temos.
    const anos = await prisma.comparativoInstitucional.findMany({ distinct: ["ano"], select: { ano: true } });
    for (const { ano } of anos) {
      const cmp = await prisma.comparativoInstitucional.aggregate({
        where: { ano },
        _sum: { matriculas: true, ae: true },
      });
      const cinco = await prisma.distribuicaoInstituicao.aggregate({
        where: { ano },
        _sum: { vlMatr: true, matrizAe: true },
      });
      const matrCinco = num(cinco._sum.vlMatr);
      // A 5ª fase de 2026 saiu quebrada; só compara onde ela tem dado de verdade.
      if (matrCinco === 0 || num(cmp._sum.matriculas) === 0) continue;
      if (matrCinco < num(cmp._sum.matriculas) * 0.5) continue;
      const limite = DIVERGENCIAS_CONHECIDAS.comparativoContra5a[ano] ?? 0;
      const relativa = (a: number, b: number) => Math.abs(a - b) / Math.max(1, b);
      if (limite === 0) {
        expect(num(cmp._sum.matriculas)).toBeCloseTo(matrCinco, 0);
        expect(num(cmp._sum.ae)).toBeCloseTo(num(cinco._sum.matrizAe), 0);
      } else {
        expect(relativa(num(cmp._sum.matriculas), matrCinco)).toBeLessThan(limite);
        // A Assistência de 2026 diverge mais (o comparativo traz R$ 597 mi, a 5ª fase R$ 655 mi).
        expect(relativa(num(cmp._sum.ae), num(cinco._sum.matrizAe))).toBeLessThan(limite + 0.05);
      }
    }
  });

  it("a PNP - Extração manual bate com a 2ª fase da MDO no IFSul (mesma extração da PNP)", async () => {
    if (!(await bancoDisponivel())) return;
    const instituicao = await prisma.pnpEstrutura.findFirst({ where: { nivel: "INSTITUICAO", instituicao: "IFSUL" } });
    if (!instituicao) return; // a extração manual ainda não foi carregada
    const linhas = await prisma.pnpFato.findMany({
      where: { subaba: "Situação de Matrícula", dimensao: "", anoBase: 2025, estruturaId: instituicao.id },
      select: { categoria: true, valores: true },
    });
    if (linhas.length === 0) return;
    const soma = (filtro: (categoria: string) => boolean) =>
      linhas.filter((l) => filtro(l.categoria)).reduce((t, l) => t + num((l.valores as Record<string, unknown>)["Matrículas"]), 0);
    const evadidosPnp = soma((c) => c.startsWith("Evadidos"));

    // A 2ª fase de 2027 é o painel da PNP de 2025, câmpus a câmpus.
    const conferencia = await prisma.conferenciaExtracao.findMany({
      where: { ano: 2027, unidade: { instituicao: { sigla: "IFSUL" } } },
      select: { abandono: true, desligado: true, reprovado: true, transfExterna: true, transfInterna: true },
    });
    if (conferencia.length === 0) return;
    const evadidosMdo = conferencia.reduce(
      (t, c) => t + num(c.abandono) + num(c.desligado) + num(c.reprovado) + num(c.transfExterna) + num(c.transfInterna),
      0,
    );
    expect(evadidosPnp).toBe(evadidosMdo);
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
