"use server";

import { parse } from "csv-parse/sync";
import { prisma } from "@/server/db/prisma";
import { getAdminSession } from "@/server/auth/session";
import { indexarComAmbiguidade, normalizarSigla } from "@/server/dadosAnuais/normalizacao";

export interface LinhaEficienciaAcademicaNaoImportada {
  linha: number;
  sigla: string;
  motivo: "instituicao_nao_encontrada" | "instituicao_ambigua" | "linha_invalida";
  candidatos?: { id: number; nome: string }[];
}

export interface ImportarEficienciaAcademicaAnualResult {
  ok: boolean;
  errorMessage?: string;
  importadas?: number;
  atualizadas?: number;
  naoImportadas?: LinhaEficienciaAcademicaNaoImportada[];
}

interface LinhaCsv {
  Sigla?: string;
  Instituicao?: string;
  UF?: string;
  ConclusaoCiclo?: string;
  EvasaoCiclo?: string;
  RetencaoCiclo?: string;
  EficienciaAcademica?: string;
}

interface LinhaParaGravar {
  instituicaoId: number;
  conclusaoCiclo: number;
  evasaoCiclo: number;
  retencaoCiclo: number;
  eficienciaAcademica: number;
}

/**
 * Server Action (admin) que importa em lote Conclusão/Evasão/Retenção de Ciclo e Eficiência
 * Acadêmica por instituição para um ano-base, a partir do CSV publicado pela CONIF (colunas
 * Sigla;Instituicao;UF;ConclusaoCiclo;EvasaoCiclo;RetencaoCiclo;EficienciaAcademica — ver
 * docs/pnp-matriz/EficienciaAcademica_2026.csv). Mesma situação de MatriculaTotalEqualizadaAnual e
 * RappAnual: valor publicado pronto pela CONIF, não deriveável agregando
 * EficienciaAcademica.csv da PNP por instituição (a Portaria SETEC/MEC 646/2022 exclui cursos FIC
 * do "ciclo", mas o CSV da PNP não distingue tipo de curso).
 *
 * Casa cada linha por `Instituicao.sigla` normalizada (maiúsculas, sem espaço/hífen/acento — fontes
 * externas variam a formatação, ex.: "IFSERTAO-PE" vs "IF SERTÃO-PE" no banco). Uma linha sem
 * candidato, ou com mais de um candidato empatado, NÃO é gravada nem adivinhada — entra em
 * `naoImportadas` para revisão manual do administrador.
 */
export async function importarEficienciaAcademicaAnualAction(
  formData: FormData,
): Promise<ImportarEficienciaAcademicaAnualResult> {
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

  const naoImportadas: LinhaEficienciaAcademicaNaoImportada[] = [];
  const paraGravar: LinhaParaGravar[] = [];

  linhas.forEach((linha, indice) => {
    const numeroLinha = indice + 2; // +1 cabeçalho, +1 base 1

    const sigla = (linha.Sigla ?? "").trim();
    if (!sigla || sigla.startsWith("\\")) {
      return; // linha de rodapé/lixo de exportação — não é dado real
    }

    const conclusaoCiclo = Number((linha.ConclusaoCiclo ?? "").trim().replace(",", "."));
    const evasaoCiclo = Number((linha.EvasaoCiclo ?? "").trim().replace(",", "."));
    const retencaoCiclo = Number((linha.RetencaoCiclo ?? "").trim().replace(",", "."));
    const eficienciaAcademica = Number((linha.EficienciaAcademica ?? "").trim().replace(",", "."));
    if (
      !Number.isFinite(conclusaoCiclo) ||
      !Number.isFinite(evasaoCiclo) ||
      !Number.isFinite(retencaoCiclo) ||
      !Number.isFinite(eficienciaAcademica)
    ) {
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

    paraGravar.push({
      instituicaoId: candidatos[0]!.id,
      conclusaoCiclo,
      evasaoCiclo,
      retencaoCiclo,
      eficienciaAcademica,
    });
  });

  const existentes = await prisma.eficienciaAcademicaAnual.findMany({
    where: { ano, instituicaoId: { in: paraGravar.map((p) => p.instituicaoId) } },
    select: { instituicaoId: true },
  });
  const idsExistentes = new Set(existentes.map((e) => e.instituicaoId));
  const novos = paraGravar.filter((item) => !idsExistentes.has(item.instituicaoId));
  const atualizacoes = paraGravar.filter((item) => idsExistentes.has(item.instituicaoId));

  // Mesmo padrão de rappAnual.ts: createMany para o import de primeira vez (caso comum), updates em
  // lotes paralelos só para reimport de um ano já existente.
  if (novos.length > 0) {
    await prisma.eficienciaAcademicaAnual.createMany({
      data: novos.map((item) => ({ ...item, ano })),
      skipDuplicates: true,
    });
  }

  const TAMANHO_LOTE = 100;
  for (let i = 0; i < atualizacoes.length; i += TAMANHO_LOTE) {
    const lote = atualizacoes.slice(i, i + TAMANHO_LOTE);
    await Promise.all(
      lote.map((item) =>
        prisma.eficienciaAcademicaAnual.update({
          where: { instituicaoId_ano: { instituicaoId: item.instituicaoId, ano } },
          data: {
            conclusaoCiclo: item.conclusaoCiclo,
            evasaoCiclo: item.evasaoCiclo,
            retencaoCiclo: item.retencaoCiclo,
            eficienciaAcademica: item.eficienciaAcademica,
          },
        }),
      ),
    );
  }

  return { ok: true, importadas: novos.length, atualizadas: atualizacoes.length, naoImportadas };
}

export interface SalvarEficienciaAcademicaAnualResult {
  ok: boolean;
  errorMessage?: string;
}

/** Server Action (admin) que grava manualmente os 4 indicadores de uma instituição/ano — para
 *  corrigir pontualmente uma linha, ou resolver um caso que ficou em `naoImportadas` no import. */
export async function salvarEficienciaAcademicaAnualAction(
  formData: FormData,
): Promise<SalvarEficienciaAcademicaAnualResult> {
  if (!(await getAdminSession())) {
    return { ok: false, errorMessage: "Não autenticado." };
  }

  const instituicaoId = Number(formData.get("instituicaoId"));
  const ano = Number(formData.get("ano"));
  if (!Number.isInteger(instituicaoId) || instituicaoId <= 0 || !Number.isInteger(ano) || ano < 2000 || ano > 2100) {
    return { ok: false, errorMessage: "Instituição ou ano inválido." };
  }

  const campos = ["conclusaoCiclo", "evasaoCiclo", "retencaoCiclo", "eficienciaAcademica"] as const;
  const valores: Record<(typeof campos)[number], number> = {
    conclusaoCiclo: 0,
    evasaoCiclo: 0,
    retencaoCiclo: 0,
    eficienciaAcademica: 0,
  };
  for (const campo of campos) {
    const bruto = formData.get(campo);
    const valor = bruto === null || bruto === "" ? NaN : Number(String(bruto).replace(",", "."));
    if (!Number.isFinite(valor)) {
      return { ok: false, errorMessage: `Valor inválido para ${campo}.` };
    }
    valores[campo] = valor;
  }

  const instituicao = await prisma.instituicao.findUnique({ where: { id: instituicaoId }, select: { id: true } });
  if (!instituicao) {
    return { ok: false, errorMessage: "Instituição inválida." };
  }

  await prisma.eficienciaAcademicaAnual.upsert({
    where: { instituicaoId_ano: { instituicaoId, ano } },
    create: { instituicaoId, ano, ...valores },
    update: valores,
  });

  return { ok: true };
}
