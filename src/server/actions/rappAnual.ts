"use server";

import { parse } from "csv-parse/sync";
import { prisma } from "@/server/db/prisma";
import { getAdminSession } from "@/server/auth/session";
import { indexarComAmbiguidade, normalizarSigla } from "@/server/dadosAnuais/normalizacao";

export interface LinhaRappNaoImportada {
  linha: number;
  sigla: string;
  motivo: "instituicao_nao_encontrada" | "instituicao_ambigua" | "linha_invalida";
  candidatos?: { id: number; nome: string }[];
}

export interface ImportarRappAnualResult {
  ok: boolean;
  errorMessage?: string;
  importadas?: number;
  atualizadas?: number;
  naoImportadas?: LinhaRappNaoImportada[];
}

interface LinhaCsv {
  Sigla?: string;
  Instituicao?: string;
  UF?: string;
  RAPP?: string;
}

/**
 * Server Action (admin) que importa em lote o RAP Presencial oficial (RAPP) por instituição para um
 * ano-base, a partir do CSV publicado pela CONIF (colunas Sigla;Instituicao;UF;RAPP — ver
 * docs/pnp-matriz/RAPP_2026.csv). Esse valor não é deriveável dos CSVs da PNP e é distinto do RAP
 * geral já calculado em calcularBlocoRap.ts (que usa TaxaEvasao.csv como aproximação documentada).
 *
 * Casa cada linha por `Instituicao.sigla` normalizada (maiúsculas, sem espaço/hífen/acento — fontes
 * externas variam a formatação, ex.: "IFSERTAO-PE" vs "IF SERTÃO-PE" no banco). Uma linha sem
 * candidato, ou com mais de um candidato empatado, NÃO é gravada nem adivinhada — entra em
 * `naoImportadas` para revisão manual do administrador.
 */
export async function importarRappAnualAction(formData: FormData): Promise<ImportarRappAnualResult> {
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

  const instituicoes = await prisma.instituicao.findMany({ select: { id: true, nome: true, sigla: true } });
  const indiceInstituicao = indexarComAmbiguidade(instituicoes, (i) => normalizarSigla(i.sigla));

  const naoImportadas: LinhaRappNaoImportada[] = [];
  const paraGravar: { instituicaoId: number; rapp: number }[] = [];

  linhas.forEach((linha, indice) => {
    const numeroLinha = indice + 2; // +1 cabeçalho, +1 base 1

    const sigla = (linha.Sigla ?? "").trim();
    if (!sigla || sigla.startsWith("\\")) {
      return; // linha de rodapé/lixo de exportação — não é dado real
    }

    const rapp = Number((linha.RAPP ?? "").trim().replace(",", "."));
    if (!Number.isFinite(rapp)) {
      naoImportadas.push({ linha: numeroLinha, sigla, motivo: "linha_invalida" });
      return;
    }

    const candidatos = indiceInstituicao.get(normalizarSigla(sigla)) ?? [];
    if (candidatos.length === 0) {
      naoImportadas.push({ linha: numeroLinha, sigla, motivo: "instituicao_nao_encontrada" });
      return;
    }
    if (candidatos.length > 1) {
      naoImportadas.push({
        linha: numeroLinha,
        sigla,
        motivo: "instituicao_ambigua",
        candidatos: candidatos.map((c) => ({ id: c.id, nome: c.nome })),
      });
      return;
    }

    paraGravar.push({ instituicaoId: candidatos[0]!.id, rapp });
  });

  const existentes = await prisma.rappAnual.findMany({
    where: { ano, instituicaoId: { in: paraGravar.map((p) => p.instituicaoId) } },
    select: { instituicaoId: true },
  });
  const idsExistentes = new Set(existentes.map((e) => e.instituicaoId));
  const novos = paraGravar.filter((item) => !idsExistentes.has(item.instituicaoId));
  const atualizacoes = paraGravar.filter((item) => idsExistentes.has(item.instituicaoId));

  // Mesmo padrão de matriculaTotalEqualizadaAnual.ts: createMany para o import de primeira vez
  // (caso comum), updates em lotes paralelos só para reimport de um ano já existente.
  if (novos.length > 0) {
    await prisma.rappAnual.createMany({
      data: novos.map((item) => ({ instituicaoId: item.instituicaoId, ano, rapp: item.rapp, origem: "PLANILHA" })),
      skipDuplicates: true,
    });
  }

  const TAMANHO_LOTE = 100;
  for (let i = 0; i < atualizacoes.length; i += TAMANHO_LOTE) {
    const lote = atualizacoes.slice(i, i + TAMANHO_LOTE);
    await Promise.all(
      lote.map((item) =>
        prisma.rappAnual.update({
          where: { instituicaoId_ano: { instituicaoId: item.instituicaoId, ano } },
          data: { rapp: item.rapp, origem: "PLANILHA" },
        }),
      ),
    );
  }

  return { ok: true, importadas: novos.length, atualizadas: atualizacoes.length, naoImportadas };
}

export interface SalvarRappAnualResult {
  ok: boolean;
  errorMessage?: string;
}

/** Server Action (admin) que grava manualmente o RAPP de uma instituição/ano — para corrigir
 *  pontualmente uma linha, ou resolver um caso que ficou em `naoImportadas` no import. */
export async function salvarRappAnualAction(formData: FormData): Promise<SalvarRappAnualResult> {
  if (!(await getAdminSession())) {
    return { ok: false, errorMessage: "Não autenticado." };
  }

  const instituicaoId = Number(formData.get("instituicaoId"));
  const ano = Number(formData.get("ano"));
  if (!Number.isInteger(instituicaoId) || instituicaoId <= 0 || !Number.isInteger(ano) || ano < 2000 || ano > 2100) {
    return { ok: false, errorMessage: "Instituição ou ano inválido." };
  }

  const rappBruto = formData.get("rapp");
  const rapp = rappBruto === null || rappBruto === "" ? NaN : Number(String(rappBruto).replace(",", "."));
  if (!Number.isFinite(rapp) || rapp < 0) {
    return { ok: false, errorMessage: "RAPP inválido." };
  }

  const instituicao = await prisma.instituicao.findUnique({ where: { id: instituicaoId }, select: { id: true } });
  if (!instituicao) {
    return { ok: false, errorMessage: "Instituição inválida." };
  }

  await prisma.rappAnual.upsert({
    where: { instituicaoId_ano: { instituicaoId, ano } },
    create: { instituicaoId, ano, rapp, origem: "CONFIGURADO" },
    update: { rapp, origem: "CONFIGURADO" },
  });

  return { ok: true };
}
