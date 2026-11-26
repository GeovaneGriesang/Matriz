import fs from "node:fs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { arquivoDoPortal } from "./caminhos";
import { UG_DO_IFSUL, nomeDaUg } from "@/lib/orcamento/lerDespesaPortal";
import { lerEmendasExecutadas } from "@/lib/orcamento/lerEmendasExecutadas";

/**
 * A prestação de contas das emendas do IFSul: lê os arquivos mensais de despesas do Portal da Transparência de cada ano
 * (`AAAAMM_Despesas_IFSul.csv`, só com as linhas do IFSul, ou o arquivo completo `AAAAMM_Despesas.csv`) e grava, por ano,
 * o que cada emenda empenhou, liquidou e pagou em cada câmpus. Pode ser repetido: apaga e regrava o ano.
 */
export interface ResultadoDoAno {
  ano: number;
  meses: number[];
  linhas: number;
  pago: number;
}

export async function carregarEmendasExecutadas(anos: readonly number[], sigla = "IFSUL"): Promise<ResultadoDoAno[]> {
  const instituicao = await prisma.instituicao.findFirst({ where: { sigla }, orderBy: { id: "asc" } });
  if (!instituicao) throw new Error(`Instituição ${sigla} não existe no banco.`);
  const unidades = await prisma.unidade.findMany({ where: { instituicaoId: instituicao.id } });
  const unidadePorNome = new Map(unidades.map((u) => [u.nome, u.id]));
  const ugs = new Set(Object.keys(UG_DO_IFSUL));

  const resultado: ResultadoDoAno[] = [];
  for (const ano of anos) {
    const dados: Prisma.EmendaExecutadaCreateManyInput[] = [];
    const meses: number[] = [];
    for (let mes = 1; mes <= 12; mes++) {
      const am = `${ano}${String(mes).padStart(2, "0")}`;
      const nome = [`${am}_Despesas_IFSul.csv`, `${am}_Despesas.csv`].find((n) => arquivoDoPortal(n));
      if (!nome) continue;
      meses.push(mes);
      const fonte = `Portal da Transparência (CGU), Despesas (execução), ${am}_Despesas.csv`;
      for (const e of lerEmendasExecutadas(fs.readFileSync(arquivoDoPortal(nome)!, "latin1"), ugs)) {
        const nomeUnidade = UG_DO_IFSUL[e.ugCodigo];
        dados.push({
          instituicaoId: instituicao.id,
          unidadeId: nomeUnidade ? (unidadePorNome.get(nomeUnidade) ?? null) : null,
          ano: e.ano,
          codigoEmenda: e.codigoEmenda,
          anoEmenda: e.anoEmenda,
          numeroNoEspelho: e.numeroNoEspelho,
          autor: e.autor.slice(0, 200),
          ugCodigo: e.ugCodigo,
          ugNome: nomeDaUg(e.ugNome).slice(0, 200),
          uoCodigo: e.uoCodigo,
          acao: e.acao,
          acaoNome: e.acaoNome.slice(0, 300),
          gnd: e.gnd,
          empenhado: e.empenhado,
          liquidado: e.liquidado,
          pago: e.pago,
          rapPago: e.rapPago,
          fonte,
        });
      }
    }
    if (meses.length === 0) continue;
    await prisma.$transaction([
      prisma.emendaExecutada.deleteMany({ where: { instituicaoId: instituicao.id, ano } }),
      prisma.emendaExecutada.createMany({ data: dados }),
    ]);
    resultado.push({ ano, meses, linhas: dados.length, pago: dados.reduce((s, d) => s + Number(d.pago) + Number(d.rapPago), 0) });
  }
  return resultado;
}
