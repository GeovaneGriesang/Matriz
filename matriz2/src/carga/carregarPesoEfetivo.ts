import { prisma } from "@/server/db/prisma";
import type { CicloObservado, LinhaPesoEfetivo } from "@/lib/mdo/pesoEfetivo";
import { consolidarTabelaDePeso } from "@/lib/mdo/pesoEfetivo";

/**
 * Monta a tabela de peso efetivo (`PesoEfetivoCurso`) a partir da 6ª fase da MDO já carregada no banco.
 *
 * Usa a rede inteira menos o IFSul: os ciclos do IFSul vêm do Excel de fórmulas e têm o bônus de agropecuária à
 * parte, e a análise que fixou os 99,77% de concordância também os deixou de fora. Roda de novo sem efeito colateral:
 * apaga e regrava só as linhas do ano de referência, dentro de uma transação.
 */

const PERIODO_PNP = (ano: number) => ({ inicio: new Date(Date.UTC(ano - 2, 0, 1)), fim: new Date(Date.UTC(ano - 2, 11, 31)) });

function textoDaFonte(l: LinhaPesoEfetivo, ano: number, arquivo: string): string {
  const pct = l.ciclosObservados > 0 ? ((l.ciclosConcordantes / l.ciclosObservados) * 100).toFixed(1).replace(".", ",") : "0";
  if (l.origem === "REGRA_FIC_SEM_CATALOGO") {
    return `Regra: o curso FIC que a MDO não achou no catálogo recebe a CH mínima padrão de 3.200 h e o peso 2,5. Conferida em ${l.ciclosConcordantes} de ${l.ciclosObservados} ciclos (${pct}%) da 6ª fase de ${ano} (${arquivo}).`;
  }
  return `Deduzido da Matrícula Total publicada na 6ª fase da MDO de ${ano} (${arquivo}): ${l.ciclosConcordantes} de ${l.ciclosObservados} ciclos desta chave concordam (${pct}%).`;
}

export async function carregarPesoEfetivo(ano: number) {
  const linhas = await prisma.distribuicaoCiclo.findMany({
    where: { ano, unidade: { instituicao: { sigla: { not: "IFSUL" } } } },
    select: {
      fonteDadosId: true, curso: true, tipoCurso: true, tipoOferta: true, pesoCursoMatriz: true, chMinimaMec: true,
      cargaHoraria: true, chMatriz: true, qtdAlunosMatriz: true, matriculaTotal: true, inicio: true, termino: true, jubilamento: true,
    },
  });

  const observados: CicloObservado[] = [];
  const fontes = new Map<number, number>();
  for (const m of linhas) {
    if (!m.inicio || !m.termino || !m.jubilamento || m.pesoCursoMatriz === null) continue;
    fontes.set(m.fonteDadosId, (fontes.get(m.fonteDadosId) ?? 0) + 1);
    observados.push({
      tipoCurso: m.tipoCurso ?? "",
      tipoOferta: m.tipoOferta ?? "",
      curso: m.curso,
      chMinimaMec: m.chMinimaMec ?? 0,
      pesoColuna: Number(m.pesoCursoMatriz),
      matriculaTotal: Number(m.matriculaTotal),
      ciclo: {
        inicio: m.inicio, termino: m.termino, jubilamento: m.jubilamento, chCiclo: m.cargaHoraria ?? 0, chMec: m.chMinimaMec ?? 0,
        chMatriz: m.chMatriz ?? 0, peso: 1, agropecuaria: false, alunos: Number(m.qtdAlunosMatriz ?? 0),
      },
    });
  }
  if (observados.length === 0) return null;

  // A fonte da tabela é a 6ª fase que mais contribuiu com ciclos.
  const fonteDadosId = [...fontes].sort((a, b) => b[1] - a[1])[0]![0];
  const fonte = await prisma.fonteDados.findUniqueOrThrow({ where: { id: fonteDadosId }, select: { arquivo: true } });

  const tabela = consolidarTabelaDePeso(observados, PERIODO_PNP(ano));
  await prisma.$transaction([
    prisma.pesoEfetivoCurso.deleteMany({ where: { anoReferencia: ano } }),
    prisma.pesoEfetivoCurso.createMany({
      data: tabela.map((l) => ({
        anoReferencia: ano,
        tipoCurso: l.tipoCurso,
        tipoOferta: l.tipoOferta,
        curso: l.curso,
        chMinimaMec: l.chMinimaMec,
        pesoEfetivo: l.pesoEfetivo,
        pesoColuna: l.pesoColuna,
        ciclosObservados: l.ciclosObservados,
        ciclosConcordantes: l.ciclosConcordantes,
        origem: l.origem,
        fonte: textoDaFonte(l, ano, fonte.arquivo),
        fonteDadosId,
      })),
    }),
  ]);

  const observadosTotal = tabela.filter((l) => l.origem !== "REGRA_FIC_SEM_CATALOGO").reduce((s, l) => s + l.ciclosObservados, 0);
  const concordantes = tabela.filter((l) => l.origem !== "REGRA_FIC_SEM_CATALOGO").reduce((s, l) => s + l.ciclosConcordantes, 0);
  return { linhas: tabela.length, ciclos: observadosTotal, concordantes, arquivo: fonte.arquivo };
}
