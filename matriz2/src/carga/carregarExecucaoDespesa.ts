import fs from "node:fs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { arquivoDoPortal } from "./caminhos";
import { UG_DO_IFSUL, lerExecucaoMensal, lerOrcamentoPorAcao, nomeDaUg } from "@/lib/orcamento/lerDespesaPortal";

/**
 * Carrega a execução da despesa de UMA instituição a partir dos arquivos do Portal da Transparência (CGU): um CSV por mês de lançamento
 * (execução por unidade gestora) e o "Orçamento da despesa" do exercício (por ação, sem UG). Só ficam as ações da matriz (20RL, 20RG, 2994) na
 * execução; o orçamento guarda todas as ações da instituição. Pode ser repetido: apaga e regrava o ano da instituição.
 */

export interface ResultadoExecucao {
  meses: number[];
  linhasExecucao: number;
  linhasOrcamento: number;
  avisos: string[];
}

export async function carregarExecucaoDespesa(sigla: string, orgaoSubordinado: string, ano: number): Promise<ResultadoExecucao> {
  const instituicao = await prisma.instituicao.findUnique({ where: { sigla: sigla.toUpperCase() } });
  if (!instituicao) throw new Error(`Instituição ${sigla} não existe no banco.`);
  const unidades = await prisma.unidade.findMany({ where: { instituicaoId: instituicao.id } });
  const unidadePorNome = new Map(unidades.map((u) => [u.nome, u.id]));

  const avisos = new Set<string>();
  const dados: Prisma.ExecucaoDespesaUgCreateManyInput[] = [];
  const meses: number[] = [];

  for (let mes = 1; mes <= 12; mes++) {
    const nome = `${ano}${String(mes).padStart(2, "0")}_Despesas.csv`;
    const caminho = arquivoDoPortal(nome);
    if (!caminho) continue;
    meses.push(mes);
    // O Portal grava em Latin-1.
    const texto = fs.readFileSync(caminho, "latin1");
    const fonte = `Portal da Transparência (CGU), Despesas, ${nome}`;
    for (const e of lerExecucaoMensal(texto, orgaoSubordinado)) {
      const nomeUnidade = UG_DO_IFSUL[e.ugCodigo];
      const unidadeId = nomeUnidade ? (unidadePorNome.get(nomeUnidade) ?? null) : null;
      if (unidadeId === null) avisos.add(`UG ${e.ugCodigo} (${nomeDaUg(e.ugNome)}) sem unidade cadastrada; gravada sem vínculo.`);
      dados.push({
        instituicaoId: instituicao.id,
        unidadeId,
        ugCodigo: e.ugCodigo,
        ugNome: nomeDaUg(e.ugNome),
        ano: e.ano,
        mes: e.mes,
        acao: e.acao,
        empenhado: e.empenhado,
        liquidado: e.liquidado,
        pago: e.pago,
        fonte,
      });
    }
  }
  if (meses.length === 0) throw new Error(`Nenhum arquivo AAAAMM_Despesas.csv de ${ano} encontrado (veja arquivoDoPortal em caminhos.ts).`);

  const orcamento: Prisma.OrcamentoDespesaAcaoCreateManyInput[] = [];
  const nomeOrc = `${ano}_OrcamentoDespesa.csv`;
  const caminhoOrc = arquivoDoPortal(nomeOrc);
  if (caminhoOrc) {
    const fonte = `Portal da Transparência (CGU), Orçamento da despesa, ${nomeOrc}`;
    for (const o of lerOrcamentoPorAcao(fs.readFileSync(caminhoOrc, "latin1"), orgaoSubordinado)) {
      orcamento.push({
        instituicaoId: instituicao.id,
        exercicio: o.exercicio,
        acao: o.acao,
        acaoDescricao: o.acaoDescricao,
        inicial: o.inicial,
        atualizado: o.atualizado,
        empenhado: o.empenhado,
        realizado: o.realizado,
        fonte,
      });
    }
  } else {
    avisos.add(`${nomeOrc} não encontrado; a tela fica sem o orçamento inicial e atualizado.`);
  }

  await prisma.$transaction([
    prisma.execucaoDespesaUg.deleteMany({ where: { instituicaoId: instituicao.id, ano } }),
    prisma.orcamentoDespesaAcao.deleteMany({ where: { instituicaoId: instituicao.id, exercicio: ano } }),
    prisma.execucaoDespesaUg.createMany({ data: dados }),
    prisma.orcamentoDespesaAcao.createMany({ data: orcamento }),
  ]);
  return { meses, linhasExecucao: dados.length, linhasOrcamento: orcamento.length, avisos: [...avisos] };
}
