"use server";

import { parse } from "csv-parse/sync";
import { prisma } from "@/server/db/prisma";
import { getAdminSession } from "@/server/auth/session";
import { indexarComAmbiguidade, normalizarNomeInstituicao } from "@/server/dadosAnuais/normalizacao";

export interface LinhaOrcamentoDistribuidoOficialNaoImportada {
  linha: number;
  instituicao: string;
  motivo: "instituicao_nao_encontrada" | "instituicao_ambigua" | "linha_invalida";
  candidatos?: { id: number; nome: string }[];
}

export interface ImportarOrcamentoDistribuidoOficialResult {
  ok: boolean;
  errorMessage?: string;
  importadas?: number;
  atualizadas?: number;
  naoImportadas?: LinhaOrcamentoDistribuidoOficialNaoImportada[];
}

interface LinhaCsv {
  Instituicao?: string;
  UF?: string;
  [coluna: string]: string | undefined;
}

function paraNumero(valor: string | undefined): number | null {
  if (valor === undefined) return null;
  const limpo = valor.trim();
  if (limpo === "") return null;
  const n = Number(limpo.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * Server Action (admin) que importa em lote, por instituição/ano-base, o Custeio (20RL) e a
 * Assistência Estudantil (2994) FINAIS distribuídos — publicados pela CONIF em `VALOR SPO` (colunas
 * J/K), já com o complemento da trava de não-decréscimo embutido (Art. 7º Portaria SETEC/MEC nº
 * 51/2018). Opcionalmente, também importa a BASE pré-trava por instituição (aba COMPARATIVO,
 * colunas AF/AK — "Custeio<ano>BaseOficial"/"Assistencia<ano>BaseOficial") — permite calcular o
 * complemento REAL (final - base) direto da planilha, sem depender do cálculo por fórmula deste
 * sistema (ver aplicarCusteioAssistenciaOficial.ts). O CSV não traz Sigla (só
 * Instituicao;UF;Custeio<ano>Oficial;Assistencia<ano>Oficial;Total<ano>Oficial[;Custeio<ano>
 * BaseOficial;Assistencia<ano>BaseOficial]) — casamento por UF + nome normalizado, mesmo critério de
 * matriculaTotalEqualizadaAnual.ts. Grava em duas tabelas (CusteioDistribuidoOficial e
 * AssistenciaDistribuidoOficial) a partir de um único arquivo/linha — ver runCalculation.ts para
 * onde esse valor substitui o cálculo por fórmula (só em runs `origem: "OFICIAL"`).
 */
export async function importarOrcamentoDistribuidoOficialAction(
  formData: FormData,
): Promise<ImportarOrcamentoDistribuidoOficialResult> {
  if (!(await getAdminSession())) {
    return { ok: false, errorMessage: "Não autenticado." };
  }

  const ano = Number(formData.get("ano"));
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) {
    return { ok: false, errorMessage: "Ano inválido." };
  }

  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File)) {
    return { ok: false, errorMessage: "Nenhum arquivo enviado." };
  }

  let linhas: LinhaCsv[];
  try {
    const texto = await arquivo.text();
    linhas = parse(texto, {
      delimiter: ";",
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,
    }) as LinhaCsv[];
  } catch (error) {
    return { ok: false, errorMessage: `CSV inválido: ${error instanceof Error ? error.message : String(error)}` };
  }

  const instituicoes = await prisma.instituicao.findMany({ select: { id: true, nome: true, uf: true } });
  const indiceInstituicao = indexarComAmbiguidade(
    instituicoes,
    (i) => `${i.uf}::${normalizarNomeInstituicao(i.nome)}`,
  );

  const naoImportadas: LinhaOrcamentoDistribuidoOficialNaoImportada[] = [];
  const paraGravar: {
    instituicaoId: number;
    custeioOficial: number;
    assistenciaOficial: number;
    custeioBaseOficial: number | null;
    assistenciaBaseOficial: number | null;
  }[] = [];

  linhas.forEach((linha, indice) => {
    const numeroLinha = indice + 2; // +1 cabeçalho, +1 base 1

    const instituicaoNome = (linha.Instituicao ?? "").trim();
    const uf = (linha.UF ?? "").trim();
    if (!instituicaoNome || instituicaoNome.startsWith("\\")) {
      return; // linha de rodapé/lixo de exportação — não é dado real
    }

    // As colunas de valor levam o ano no nome (ex.: "Custeio2026Oficial") — procura por
    // "Custeio"/"Assistencia" + "Oficial", distinguindo o valor FINAL ("...Oficial", sem "Base")
    // da BASE pré-trava opcional ("...BaseOficial").
    const colunas = Object.keys(linha);
    const colunaCusteio = colunas.find((c) => c.startsWith("Custeio") && c.includes("Oficial") && !c.includes("Base"));
    const colunaAssistencia = colunas.find(
      (c) => c.startsWith("Assistencia") && c.includes("Oficial") && !c.includes("Base"),
    );
    const colunaCusteioBase = colunas.find((c) => c.startsWith("Custeio") && c.includes("BaseOficial"));
    const colunaAssistenciaBase = colunas.find((c) => c.startsWith("Assistencia") && c.includes("BaseOficial"));
    const custeioOficial = paraNumero(colunaCusteio ? linha[colunaCusteio] : undefined);
    const assistenciaOficial = paraNumero(colunaAssistencia ? linha[colunaAssistencia] : undefined);
    // A base pré-trava é opcional — nem todo CSV precisa trazê-la (ver docstring da action).
    const custeioBaseOficial = colunaCusteioBase ? paraNumero(linha[colunaCusteioBase]) : null;
    const assistenciaBaseOficial = colunaAssistenciaBase ? paraNumero(linha[colunaAssistenciaBase]) : null;

    if (custeioOficial === null || assistenciaOficial === null) {
      naoImportadas.push({ linha: numeroLinha, instituicao: instituicaoNome, motivo: "linha_invalida" });
      return;
    }

    const candidatos = indiceInstituicao.get(`${uf}::${normalizarNomeInstituicao(instituicaoNome)}`) ?? [];
    if (candidatos.length === 0) {
      naoImportadas.push({ linha: numeroLinha, instituicao: instituicaoNome, motivo: "instituicao_nao_encontrada" });
      return;
    }
    if (candidatos.length > 1) {
      naoImportadas.push({
        linha: numeroLinha,
        instituicao: instituicaoNome,
        motivo: "instituicao_ambigua",
        candidatos: candidatos.map((c) => ({ id: c.id, nome: c.nome })),
      });
      return;
    }

    paraGravar.push({
      instituicaoId: candidatos[0]!.id,
      custeioOficial,
      assistenciaOficial,
      custeioBaseOficial,
      assistenciaBaseOficial,
    });
  });

  const existentesCusteio = await prisma.custeioDistribuidoOficial.findMany({
    where: { ano, instituicaoId: { in: paraGravar.map((p) => p.instituicaoId) } },
    select: { instituicaoId: true },
  });
  const idsComCusteio = new Set(existentesCusteio.map((e) => e.instituicaoId));
  const novosCusteio = paraGravar.filter((item) => !idsComCusteio.has(item.instituicaoId));
  const atualizacoesCusteio = paraGravar.filter((item) => idsComCusteio.has(item.instituicaoId));

  if (novosCusteio.length > 0) {
    await prisma.custeioDistribuidoOficial.createMany({
      data: novosCusteio.map((item) => ({
        instituicaoId: item.instituicaoId,
        ano,
        custeioOficial: item.custeioOficial,
        custeioBaseOficial: item.custeioBaseOficial,
      })),
      skipDuplicates: true,
    });
  }

  const existentesAssistencia = await prisma.assistenciaDistribuidoOficial.findMany({
    where: { ano, instituicaoId: { in: paraGravar.map((p) => p.instituicaoId) } },
    select: { instituicaoId: true },
  });
  const idsComAssistencia = new Set(existentesAssistencia.map((e) => e.instituicaoId));
  const novosAssistencia = paraGravar.filter((item) => !idsComAssistencia.has(item.instituicaoId));
  const atualizacoesAssistencia = paraGravar.filter((item) => idsComAssistencia.has(item.instituicaoId));

  if (novosAssistencia.length > 0) {
    await prisma.assistenciaDistribuidoOficial.createMany({
      data: novosAssistencia.map((item) => ({
        instituicaoId: item.instituicaoId,
        ano,
        assistenciaOficial: item.assistenciaOficial,
        assistenciaBaseOficial: item.assistenciaBaseOficial,
      })),
      skipDuplicates: true,
    });
  }

  const TAMANHO_LOTE = 100;
  for (let i = 0; i < atualizacoesCusteio.length; i += TAMANHO_LOTE) {
    const lote = atualizacoesCusteio.slice(i, i + TAMANHO_LOTE);
    await Promise.all(
      lote.map((item) =>
        prisma.custeioDistribuidoOficial.update({
          where: { instituicaoId_ano: { instituicaoId: item.instituicaoId, ano } },
          data: { custeioOficial: item.custeioOficial, custeioBaseOficial: item.custeioBaseOficial },
        }),
      ),
    );
  }
  for (let i = 0; i < atualizacoesAssistencia.length; i += TAMANHO_LOTE) {
    const lote = atualizacoesAssistencia.slice(i, i + TAMANHO_LOTE);
    await Promise.all(
      lote.map((item) =>
        prisma.assistenciaDistribuidoOficial.update({
          where: { instituicaoId_ano: { instituicaoId: item.instituicaoId, ano } },
          data: { assistenciaOficial: item.assistenciaOficial, assistenciaBaseOficial: item.assistenciaBaseOficial },
        }),
      ),
    );
  }

  return {
    ok: true,
    importadas: novosCusteio.length,
    atualizadas: atualizacoesCusteio.length,
    naoImportadas,
  };
}

export interface SalvarOrcamentoDistribuidoOficialResult {
  ok: boolean;
  errorMessage?: string;
}

/** Server Action (admin) que grava manualmente o Custeio/Assistência oficiais de uma
 *  instituição/ano — para corrigir pontualmente uma linha, ou resolver um caso que ficou em
 *  `naoImportadas` no import. */
export async function salvarOrcamentoDistribuidoOficialAction(
  formData: FormData,
): Promise<SalvarOrcamentoDistribuidoOficialResult> {
  if (!(await getAdminSession())) {
    return { ok: false, errorMessage: "Não autenticado." };
  }

  const instituicaoId = Number(formData.get("instituicaoId"));
  const ano = Number(formData.get("ano"));
  if (!Number.isInteger(instituicaoId) || instituicaoId <= 0 || !Number.isInteger(ano) || ano < 2000 || ano > 2100) {
    return { ok: false, errorMessage: "Instituição ou ano inválido." };
  }

  const custeioBruto = formData.get("custeioOficial");
  const custeioOficial =
    custeioBruto === null || custeioBruto === "" ? NaN : Number(String(custeioBruto).replace(",", "."));
  const assistenciaBruto = formData.get("assistenciaOficial");
  const assistenciaOficial =
    assistenciaBruto === null || assistenciaBruto === "" ? NaN : Number(String(assistenciaBruto).replace(",", "."));
  // Base pré-trava — opcional (ver docstring do import).
  const custeioBaseBruto = formData.get("custeioBaseOficial");
  const custeioBaseOficial =
    custeioBaseBruto === null || custeioBaseBruto === "" ? null : Number(String(custeioBaseBruto).replace(",", "."));
  const assistenciaBaseBruto = formData.get("assistenciaBaseOficial");
  const assistenciaBaseOficial =
    assistenciaBaseBruto === null || assistenciaBaseBruto === ""
      ? null
      : Number(String(assistenciaBaseBruto).replace(",", "."));

  if (!Number.isFinite(custeioOficial) || custeioOficial < 0) {
    return { ok: false, errorMessage: "Custeio oficial inválido." };
  }
  if (!Number.isFinite(assistenciaOficial) || assistenciaOficial < 0) {
    return { ok: false, errorMessage: "Assistência oficial inválida." };
  }
  if (custeioBaseOficial !== null && (!Number.isFinite(custeioBaseOficial) || custeioBaseOficial < 0)) {
    return { ok: false, errorMessage: "Custeio base oficial inválido." };
  }
  if (assistenciaBaseOficial !== null && (!Number.isFinite(assistenciaBaseOficial) || assistenciaBaseOficial < 0)) {
    return { ok: false, errorMessage: "Assistência base oficial inválida." };
  }

  const instituicao = await prisma.instituicao.findUnique({ where: { id: instituicaoId }, select: { id: true } });
  if (!instituicao) {
    return { ok: false, errorMessage: "Instituição inválida." };
  }

  await prisma.custeioDistribuidoOficial.upsert({
    where: { instituicaoId_ano: { instituicaoId, ano } },
    create: { instituicaoId, ano, custeioOficial, custeioBaseOficial },
    update: { custeioOficial, custeioBaseOficial },
  });
  await prisma.assistenciaDistribuidoOficial.upsert({
    where: { instituicaoId_ano: { instituicaoId, ano } },
    create: { instituicaoId, ano, assistenciaOficial, assistenciaBaseOficial },
    update: { assistenciaOficial, assistenciaBaseOficial },
  });

  return { ok: true };
}
