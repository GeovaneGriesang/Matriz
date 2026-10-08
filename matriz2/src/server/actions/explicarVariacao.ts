"use server";

import { temAcessoPleno } from "@/lib/permissoes";
import { getAdminSession } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { explicarVariacao, type CicloParaExplicar, type ExplicacaoVariacao } from "@/lib/mdo/explicarVariacao";

export interface ResultadoExplicacao {
  ok: boolean;
  errorMessage?: string;
  explicacao?: ExplicacaoVariacao;
  /** Por que não foi possível explicar (ano sem dados de matrícula, câmpus novo etc.). */
  motivoSemExplicacao?: string;
}

const n = (v: unknown) => Number(v ?? 0);

async function carregarCiclo(ano: number, unidadeId: number): Promise<CicloParaExplicar | string> {
  const [campus, ciclo] = await Promise.all([
    prisma.distribuicaoCampus.findUnique({ where: { ano_unidadeId: { ano, unidadeId } } }),
    prisma.cicloOrcamento.findUnique({ where: { ano } }),
  ]);
  if (!campus) return `O câmpus não existe na 5ª fase de ${ano} (câmpus novo, ou o ciclo ainda não foi carregado).`;
  if (!ciclo || ciclo.valorMatriculaPresencial === null) {
    return `O ciclo ${ano} não tem o valor de uma matrícula carregado, então não dá para separar o efeito de matrícula do efeito de valor.`;
  }
  return {
    ano,
    mt: {
      presencial: n(campus.mtPresencial),
      ead: n(campus.mtEad),
      eadMooc: n(campus.mtEadMooc),
      eadFp: n(campus.mtEadFp),
    },
    valorMatricula: {
      presencial: n(ciclo.valorMatriculaPresencial),
      ead: n(ciclo.valorMatriculaEad),
      eadMooc: n(ciclo.valorMatriculaEadMooc),
      eadFp: n(ciclo.valorMatriculaEadFp),
    },
    final: n(campus.vlMatrFinal),
    fundoRede: n(ciclo.funcionamentoTotal) - n(ciclo.pisoTotal),
  };
}

/**
 * Explica, para um câmpus, por que o valor da MATRIZ (Funcionamento) mudou entre dois
 * ciclos. Só a matriz: o "informado" é digitado por um administrador e não tem um
 * "porquê" para decompor.
 */
export async function explicarVariacaoCampusAction(unidadeId: number, anoA: number, anoB: number): Promise<ResultadoExplicacao> {
  const usuario = await getAdminSession();
  if (!usuario || !temAcessoPleno(usuario.papel)) return { ok: false, errorMessage: "Não autorizado." };

  const [a, b] = await Promise.all([carregarCiclo(anoA, unidadeId), carregarCiclo(anoB, unidadeId)]);
  if (typeof a === "string") return { ok: true, motivoSemExplicacao: a };
  if (typeof b === "string") return { ok: true, motivoSemExplicacao: b };
  const explicacao = explicarVariacao(a, b);
  if (!explicacao) return { ok: true, motivoSemExplicacao: "Falta o valor de uma matrícula presencial em um dos ciclos." };
  return { ok: true, explicacao };
}
