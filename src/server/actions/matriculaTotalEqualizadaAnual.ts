"use server";

import { parse } from "csv-parse/sync";
import { prisma } from "@/server/db/prisma";
import { getAdminSession } from "@/server/auth/session";
import { normalizarNomeUnidade } from "@/server/dadosAnuais/normalizacao";
import {
  classificarLinhas,
  construirIndicesDeCasamento,
  type AnoCriacaoDivergente,
  type CampusAusenteNaPlanilha,
  type IndicesDeCasamento,
  type ImportarMatriculaTotalEqualizadaAnualResult,
  type LinhaCsv,
} from "@/server/dadosAnuais/matriculaTotalEqualizadaCsv";

async function carregarIndicesDeCasamento(): Promise<IndicesDeCasamento> {
  const [instituicoes, unidades] = await Promise.all([
    prisma.instituicao.findMany({ select: { id: true, nome: true, uf: true } }),
    prisma.unidade.findMany({ select: { id: true, nome: true, instituicaoId: true, anoCriacao: true } }),
  ]);
  return construirIndicesDeCasamento(instituicoes, unidades);
}

/**
 * Cria em lote os câmpus que a planilha traz e o sistema não tem, já com o ano de criação informado
 * por ela. Só é chamada quando o administrador confirma explicitamente na tela — criar câmpus muda
 * a distribuição do Piso Mínimo por Câmpus Novo, então não pode ser efeito colateral invisível de
 * um import de matrícula.
 */
async function criarCampusDaPlanilha(ausentes: CampusAusenteNaPlanilha[]): Promise<number> {
  const vistos = new Set<string>();
  const novos: { instituicaoId: number; nome: string; anoCriacao: number | null }[] = [];
  for (const ausente of ausentes) {
    // A planilha lista um câmpus por ano do orçamento, mas nada impede uma linha repetida;
    // `createMany` não aceita duplicata dentro do próprio lote nem com `skipDuplicates`, que só
    // ignora conflito com o que já está gravado.
    const chave = `${ausente.instituicaoId}::${normalizarNomeUnidade(ausente.campus)}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    novos.push({ instituicaoId: ausente.instituicaoId, nome: ausente.campus, anoCriacao: ausente.anoCriacao });
  }
  if (novos.length === 0) return 0;
  const { count } = await prisma.unidade.createMany({ data: novos, skipDuplicates: true });
  return count;
}

/**
 * Server Action (admin) que importa em lote a Matrícula Total equalizada por câmpus para um ano do
 * orçamento, a partir do CSV publicado pela CONIF (colunas Instituicao;UF;Campus;AnoCriacaoCampus;
 * MatriculaTotalPresencialEqualizada;MatriculaTotalEadEqualizada;MatriculaTotalEadMoocEqualizada;
 * MatriculaTotalEadFpEqualizada — ver docs/pnp-matriz/MatriculaTotalEqualizada_2026.csv). Esse valor
 * não é deriveável dos CSVs da PNP (ver src/calculation-engine/pendentes/matriculaTotalEqualizada.ts).
 *
 * Casa cada linha contra `Instituicao` por UF + nome normalizado (removendo por completo, não
 * canonicalizando, as preposições "de/do/da/dos/das" — fontes externas às vezes as omitem inteiras,
 * ex. "Sul Minas Gerais" em vez de "Sul de Minas Gerais" para o IFSULDEMINAS) e, dentro da
 * instituição resolvida, contra `Unidade` por nome normalizado só de acento/caixa (palavras como
 * "Avançado"/"Centro de Referência" continuam distinguindo câmpus diferentes). Uma linha com mais de
 * um candidato empatado após a normalização NÃO é gravada nem adivinhada — entra em `naoImportadas`
 * com os candidatos encontrados para revisão manual do administrador.
 *
 * Além da matrícula, esta importação **alimenta o cadastro de Câmpus** com as duas informações que
 * antes só existiam por digitação (ver src/app/admin/unidades/page.tsx):
 *
 * 1. `AnoCriacaoCampus` preenche `Unidade.anoCriacao` **apenas quando está vazio**. Um ano já
 *    revisado à mão nunca é sobrescrito em silêncio: a divergência é devolvida em
 *    `anosCriacaoDivergentes` para o administrador decidir. Conferido em 2026-08-31 contra as
 *    planilhas de 2026 e 2027: nos 629 e 625 câmpus que casaram, **zero divergências** — a coluna
 *    reproduz exatamente o que havia sido pré-carregado à mão da aba "Completo Proposta".
 * 2. Os câmpus que a planilha traz e o sistema não tem são devolvidos em `campusAusentes` e criados
 *    somente se `criarCampusAusentes` vier marcado. São 27 na planilha de 2026 e 74 na de 2027 —
 *    câmpus sem matrícula, que por isso não existem em nenhum arquivo da PNP e nunca nasceriam da
 *    ingestão, mas que a matriz da CONIF já contempla pelo Piso Mínimo (R$ 28,7 milhões no ciclo
 *    2027 que o sistema não conseguia atribuir a ninguém). Antes desta mudança eles eram
 *    simplesmente descartados como `campus_nao_encontrado`.
 *
 * Instituição ausente continua NÃO sendo criada: o CSV só traz nome e UF, e `Instituicao` exige
 * ainda região, estado e organização acadêmica. É o caso do IF do Sertão Paraibano, novo no ciclo
 * 2027 (7 linhas) — ele entra sozinho no próximo extrato da PNP.
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

  const criarCampusAusentes = formData.get("criarCampusAusentes") === "1";

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

  let classificacao = classificarLinhas(linhas, await carregarIndicesDeCasamento());

  let campusCriados = 0;
  if (criarCampusAusentes && classificacao.campusAusentes.length > 0) {
    campusCriados = await criarCampusDaPlanilha(classificacao.campusAusentes);
    classificacao = classificarLinhas(linhas, await carregarIndicesDeCasamento());
  }

  // ---- Ano de criação: preenche o que está vazio, nunca sobrescreve o que já foi revisado ----
  const anosParaPreencher = new Map<number, number>();
  const anosCriacaoDivergentes: AnoCriacaoDivergente[] = [];
  for (const resolvida of classificacao.resolvidas) {
    if (resolvida.anoNaPlanilha === null) continue;
    if (resolvida.anoNoSistema === null) {
      anosParaPreencher.set(resolvida.unidadeId, resolvida.anoNaPlanilha);
    } else if (resolvida.anoNoSistema !== resolvida.anoNaPlanilha) {
      anosCriacaoDivergentes.push({
        unidadeId: resolvida.unidadeId,
        instituicao: resolvida.instituicao,
        campus: resolvida.campus,
        anoNoSistema: resolvida.anoNoSistema,
        anoNaPlanilha: resolvida.anoNaPlanilha,
      });
    }
  }

  const TAMANHO_LOTE = 100;
  const preenchimentos = Array.from(anosParaPreencher.entries());
  for (let i = 0; i < preenchimentos.length; i += TAMANHO_LOTE) {
    await Promise.all(
      preenchimentos
        .slice(i, i + TAMANHO_LOTE)
        .map(([unidadeId, anoCriacao]) => prisma.unidade.update({ where: { id: unidadeId }, data: { anoCriacao } })),
    );
  }

  // ---- Matrícula Total equalizada ----
  const paraGravar = classificacao.resolvidas.map((r) => ({
    unidadeId: r.unidadeId,
    matriculaTotalPresencialEqualizada: r.matriculaTotalPresencialEqualizada,
    matriculaTotalEadEqualizada: r.matriculaTotalEadEqualizada,
    matriculaTotalEadMoocEqualizada: r.matriculaTotalEadMoocEqualizada,
    matriculaTotalEadFpEqualizada: r.matriculaTotalEadFpEqualizada,
  }));

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
      data: novos.map((item) => ({ ...item, ano, origem: "PLANILHA" })),
      skipDuplicates: true,
    });
  }

  for (let i = 0; i < atualizacoes.length; i += TAMANHO_LOTE) {
    const lote = atualizacoes.slice(i, i + TAMANHO_LOTE);
    await Promise.all(
      lote.map((item) =>
        prisma.matriculaTotalEqualizadaAnual.update({
          where: { unidadeId_ano: { unidadeId: item.unidadeId, ano } },
          data: { ...item, origem: "PLANILHA" },
        }),
      ),
    );
  }

  return {
    ok: true,
    importadas: novos.length,
    atualizadas: atualizacoes.length,
    naoImportadas: classificacao.naoImportadas,
    campusAusentes: classificacao.campusAusentes,
    campusCriados,
    anosCriacaoPreenchidos: anosParaPreencher.size,
    anosCriacaoDivergentes,
  };
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
    create: { unidadeId, ano, ...valores, origem: "CONFIGURADO" },
    update: { ...valores, origem: "CONFIGURADO" },
  });

  return { ok: true };
}
