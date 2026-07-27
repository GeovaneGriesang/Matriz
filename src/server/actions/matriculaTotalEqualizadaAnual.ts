"use server";

import { parse } from "csv-parse/sync";
import { prisma } from "@/server/db/prisma";
import { getAdminSession } from "@/server/auth/session";
import { indexarComAmbiguidade, normalizarNomeInstituicao, normalizarNomeUnidade } from "@/server/dadosAnuais/normalizacao";

export interface LinhaMatriculaNaoImportada {
  linha: number;
  instituicao: string;
  campus: string;
  motivo: "instituicao_nao_encontrada" | "instituicao_ambigua" | "campus_nao_encontrado" | "campus_ambiguo";
  candidatos?: { id: number; nome: string }[];
}

export interface ImportarMatriculaTotalEqualizadaAnualResult {
  ok: boolean;
  errorMessage?: string;
  importadas?: number;
  atualizadas?: number;
  naoImportadas?: LinhaMatriculaNaoImportada[];
}

interface LinhaCsv {
  Instituicao?: string;
  UF?: string;
  Campus?: string;
  MatriculaTotalPresencialEqualizada?: string;
  MatriculaTotalEadEqualizada?: string;
  MatriculaTotalEadMoocEqualizada?: string;
  MatriculaTotalEadFpEqualizada?: string;
}

function paraNumero(valor: string | undefined): number {
  if (valor === undefined) return 0;
  const limpo = valor.trim();
  if (limpo === "") return 0;
  const n = Number(limpo.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Server Action (admin) que importa em lote a Matrícula Total equalizada por câmpus para um
 * ano-base, a partir do CSV publicado pela CONIF (colunas Instituicao;UF;Campus;
 * MatriculaTotalPresencialEqualizada;MatriculaTotalEadEqualizada;MatriculaTotalEadMoocEqualizada;
 * MatriculaTotalEadFpEqualizada — ver docs/pnp-matriz/MatriculaTotalEqualizada_2026.csv). Esse valor
 * não é deriveável dos CSVs da PNP (ver src/calculation-engine/pendentes/matriculaTotalEqualizada.ts).
 *
 * Casa cada linha contra `Instituicao` por UF + nome normalizado (removendo por completo, não
 * canonicalizando, as preposições "de/do/da/dos/das" — fontes externas às vezes as omitem inteiras,
 * ex. "Sul Minas Gerais" em vez de "Sul de Minas Gerais" para o IFSULDEMINAS) e, dentro da
 * instituição resolvida, contra `Unidade` por nome normalizado só de acento/caixa (palavras como
 * "Avançado"/"Centro de Referência" continuam distinguindo câmpus diferentes). Uma linha sem nenhum
 * candidato, ou com mais de um candidato empatado após a normalização, NÃO é gravada nem adivinhada
 * — entra em `naoImportadas` com os candidatos encontrados para revisão manual do administrador.
 */
export async function importarMatriculaTotalEqualizadaAnualAction(
  formData: FormData,
): Promise<ImportarMatriculaTotalEqualizadaAnualResult> {
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
  const unidades = await prisma.unidade.findMany({ select: { id: true, nome: true, instituicaoId: true } });

  const indiceInstituicao = indexarComAmbiguidade(
    instituicoes,
    (i) => `${i.uf}::${normalizarNomeInstituicao(i.nome)}`,
  );
  const indiceUnidade = indexarComAmbiguidade(
    unidades,
    (u) => `${u.instituicaoId}::${normalizarNomeUnidade(u.nome)}`,
  );

  const naoImportadas: LinhaMatriculaNaoImportada[] = [];
  const paraGravar: {
    unidadeId: number;
    matriculaTotalPresencialEqualizada: number;
    matriculaTotalEadEqualizada: number;
    matriculaTotalEadMoocEqualizada: number;
    matriculaTotalEadFpEqualizada: number;
  }[] = [];

  linhas.forEach((linha, indice) => {
    const numeroLinha = indice + 2; // +1 cabeçalho, +1 base 1

    const instituicaoNome = (linha.Instituicao ?? "").trim();
    const uf = (linha.UF ?? "").trim();
    const campus = (linha.Campus ?? "").trim();

    // Linha de rodapé/lixo de exportação (ex.: cabeçalho duplicado "\instituicao_ds_nome;...") — não é dado real.
    if (!instituicaoNome || instituicaoNome.startsWith("\\") || !campus) {
      return;
    }

    const candidatosInstituicao = indiceInstituicao.get(`${uf}::${normalizarNomeInstituicao(instituicaoNome)}`) ?? [];
    if (candidatosInstituicao.length === 0) {
      naoImportadas.push({ linha: numeroLinha, instituicao: instituicaoNome, campus, motivo: "instituicao_nao_encontrada" });
      return;
    }
    if (candidatosInstituicao.length > 1) {
      naoImportadas.push({
        linha: numeroLinha,
        instituicao: instituicaoNome,
        campus,
        motivo: "instituicao_ambigua",
        candidatos: candidatosInstituicao.map((c) => ({ id: c.id, nome: c.nome })),
      });
      return;
    }
    const instituicaoId = candidatosInstituicao[0]!.id;

    const candidatosUnidade = indiceUnidade.get(`${instituicaoId}::${normalizarNomeUnidade(campus)}`) ?? [];
    if (candidatosUnidade.length === 0) {
      naoImportadas.push({ linha: numeroLinha, instituicao: instituicaoNome, campus, motivo: "campus_nao_encontrado" });
      return;
    }
    if (candidatosUnidade.length > 1) {
      naoImportadas.push({
        linha: numeroLinha,
        instituicao: instituicaoNome,
        campus,
        motivo: "campus_ambiguo",
        candidatos: candidatosUnidade.map((c) => ({ id: c.id, nome: c.nome })),
      });
      return;
    }

    paraGravar.push({
      unidadeId: candidatosUnidade[0]!.id,
      matriculaTotalPresencialEqualizada: paraNumero(linha.MatriculaTotalPresencialEqualizada),
      matriculaTotalEadEqualizada: paraNumero(linha.MatriculaTotalEadEqualizada),
      matriculaTotalEadMoocEqualizada: paraNumero(linha.MatriculaTotalEadMoocEqualizada),
      matriculaTotalEadFpEqualizada: paraNumero(linha.MatriculaTotalEadFpEqualizada),
    });
  });

  const existentes = await prisma.matriculaTotalEqualizadaAnual.findMany({
    where: { ano, unidadeId: { in: paraGravar.map((p) => p.unidadeId) } },
    select: { unidadeId: true },
  });
  const idsExistentes = new Set(existentes.map((e) => e.unidadeId));
  const novos = paraGravar.filter((item) => !idsExistentes.has(item.unidadeId));
  const atualizacoes = paraGravar.filter((item) => idsExistentes.has(item.unidadeId));

  // Import de primeira vez (caso comum) vira um único createMany — medido em ~600ms para 650 linhas.
  // Update teria que ser upsert por linha, que é ~170ms de round-trip cada — 650 sequenciais passa de
  // 100s (testado ao vivo, estourou timeout de 120s do driver de teste). Paraleliza em lotes.
  if (novos.length > 0) {
    await prisma.matriculaTotalEqualizadaAnual.createMany({
      data: novos.map((item) => ({ ...item, ano })),
      skipDuplicates: true,
    });
  }

  const TAMANHO_LOTE = 100;
  for (let i = 0; i < atualizacoes.length; i += TAMANHO_LOTE) {
    const lote = atualizacoes.slice(i, i + TAMANHO_LOTE);
    await Promise.all(
      lote.map((item) =>
        prisma.matriculaTotalEqualizadaAnual.update({
          where: { unidadeId_ano: { unidadeId: item.unidadeId, ano } },
          data: item,
        }),
      ),
    );
  }

  return { ok: true, importadas: novos.length, atualizadas: atualizacoes.length, naoImportadas };
}

export interface SalvarMatriculaTotalEqualizadaAnualResult {
  ok: boolean;
  errorMessage?: string;
}

/** Server Action (admin) que grava manualmente a Matrícula Total equalizada de um câmpus/ano — para
 *  corrigir pontualmente uma linha, ou resolver um caso que ficou em `naoImportadas` no import. */
export async function salvarMatriculaTotalEqualizadaAnualAction(
  formData: FormData,
): Promise<SalvarMatriculaTotalEqualizadaAnualResult> {
  if (!(await getAdminSession())) {
    return { ok: false, errorMessage: "Não autenticado." };
  }

  const unidadeId = Number(formData.get("unidadeId"));
  const ano = Number(formData.get("ano"));
  if (!Number.isInteger(unidadeId) || unidadeId <= 0 || !Number.isInteger(ano) || ano < 2000 || ano > 2100) {
    return { ok: false, errorMessage: "Câmpus ou ano inválido." };
  }

  const campos = [
    "matriculaTotalPresencialEqualizada",
    "matriculaTotalEadEqualizada",
    "matriculaTotalEadMoocEqualizada",
    "matriculaTotalEadFpEqualizada",
  ] as const;

  const valores: Record<(typeof campos)[number], number> = {
    matriculaTotalPresencialEqualizada: 0,
    matriculaTotalEadEqualizada: 0,
    matriculaTotalEadMoocEqualizada: 0,
    matriculaTotalEadFpEqualizada: 0,
  };
  for (const campo of campos) {
    const bruto = formData.get(campo);
    const n = bruto === null || bruto === "" ? 0 : Number(String(bruto).replace(",", "."));
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, errorMessage: `Valor inválido em ${campo}.` };
    }
    valores[campo] = n;
  }

  const unidade = await prisma.unidade.findUnique({ where: { id: unidadeId }, select: { id: true } });
  if (!unidade) {
    return { ok: false, errorMessage: "Câmpus inválido." };
  }

  await prisma.matriculaTotalEqualizadaAnual.upsert({
    where: { unidadeId_ano: { unidadeId, ano } },
    create: { unidadeId, ano, ...valores },
    update: valores,
  });

  return { ok: true };
}
