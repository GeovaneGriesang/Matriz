"use server";

import type { CategoriaRepasse } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { getAdminSession } from "@/server/auth/session";
import { normalizarCategoriaRepasse, normalizarPesoRepasse } from "@/server/composicaoRepasse/normalizacao";
import { lerPlanilhaComposicao } from "@/server/composicaoRepasse/lerPlanilhaComposicao";

export interface LinhaComposicaoNaoImportada {
  linha: number;
  modalidade: string;
  fonte: string;
  motivo: "categoria_invalida" | "peso_invalido" | "linha_incompleta";
  detalhe?: string;
}

export interface ImportarComposicaoRepasseResult {
  ok: boolean;
  errorMessage?: string;
  importadas?: number;
  atualizadas?: number;
  removidas?: number;
  naoImportadas?: LinhaComposicaoNaoImportada[];
  /** Pesos resultantes por categoria, para a tela confirmar o que passou a valer naquele ano. */
  pesosPorCategoria?: { categoria: CategoriaRepasse; peso: number; linhas: number }[];
  /** Categorias em que as linhas não concordam no peso — cadastro suspeito, exibido como alerta. */
  categoriasInconsistentes?: string[];
}

/**
 * Server Action (admin) que importa a Composição de Repasse de um ano-base a partir do CSV
 * exportado da planilha da CONIF (colunas Modalidade;FonteFinanciamento;Repasse;Porcentagem).
 *
 * Essa tabela define os pesos por modalidade usados nos Blocos Funcionamento e Reitorias, e eles
 * **mudam entre ciclos**: o EAD MOOC valia 0,8 em 2026 e passou a 0,08 em 2027. Antes eram
 * constantes no código; agora cada ano tem os seus, e recalcular um ano antigo continua
 * reproduzindo o resultado publicado na época.
 *
 * A importação **substitui** a composição daquele ano (o arquivo é a fonte da verdade), dentro de
 * uma transação. Linha com categoria ou peso irreconhecível não é adivinhada: fica em
 * `naoImportadas` para o administrador revisar.
 */
export async function importarComposicaoRepasseAction(
  formData: FormData,
): Promise<ImportarComposicaoRepasseResult> {
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

  const leitura = await lerPlanilhaComposicao(arquivo.name, await arquivo.arrayBuffer());
  if (!leitura.ok) {
    return { ok: false, errorMessage: leitura.erro };
  }
  const linhas = leitura.linhas;

  const naoImportadas: LinhaComposicaoNaoImportada[] = [];
  const paraGravar: {
    modalidadeEnsino: string;
    fonteFinanciamento: string;
    categoriaRepasse: CategoriaRepasse;
    peso: number;
  }[] = [];

  linhas.forEach((linha) => {
    const numeroLinha = linha.linha;
    const { modalidade, fonte, repasse, porcentagem } = linha;

    if (modalidade === "" || fonte === "") {
      if (modalidade !== "" || fonte !== "" || repasse !== "" || porcentagem !== "") {
        naoImportadas.push({ linha: numeroLinha, modalidade, fonte, motivo: "linha_incompleta" });
      }
      return;
    }

    const categoria = normalizarCategoriaRepasse(repasse);
    if (categoria === null) {
      naoImportadas.push({
        linha: numeroLinha,
        modalidade,
        fonte,
        motivo: "categoria_invalida",
        detalhe: `"${repasse}" não é PRESENCIAL, EAD, EAD MOOC nem EAD FP.`,
      });
      return;
    }

    const peso = normalizarPesoRepasse(porcentagem);
    if (peso === null) {
      naoImportadas.push({
        linha: numeroLinha,
        modalidade,
        fonte,
        motivo: "peso_invalido",
        detalhe: `"${porcentagem}" não é um peso entre 0 e 1 (nem um percentual válido).`,
      });
      return;
    }

    paraGravar.push({
      modalidadeEnsino: modalidade,
      fonteFinanciamento: fonte,
      categoriaRepasse: categoria,
      peso,
    });
  });

  if (paraGravar.length === 0) {
    return {
      ok: false,
      errorMessage:
        "Nenhuma linha válida encontrada. Confira se o arquivo tem as colunas " +
        "Modalidade;FonteFinanciamento;Repasse;Porcentagem separadas por ponto-e-vírgula.",
      naoImportadas,
    };
  }

  const existentes = await prisma.composicaoRepasseAnual.count({ where: { ano } });

  await prisma.$transaction(async (tx) => {
    await tx.composicaoRepasseAnual.deleteMany({ where: { ano } });
    await tx.composicaoRepasseAnual.createMany({
      data: paraGravar.map((l) => ({ ano, ...l })),
    });
  });

  const pesoPorCategoria = new Map<CategoriaRepasse, { peso: number; linhas: number; divergente: boolean }>();
  for (const l of paraGravar) {
    const atual = pesoPorCategoria.get(l.categoriaRepasse);
    if (atual === undefined) {
      pesoPorCategoria.set(l.categoriaRepasse, { peso: l.peso, linhas: 1, divergente: false });
    } else {
      pesoPorCategoria.set(l.categoriaRepasse, {
        peso: l.peso,
        linhas: atual.linhas + 1,
        divergente: atual.divergente || atual.peso !== l.peso,
      });
    }
  }

  return {
    ok: true,
    importadas: existentes === 0 ? paraGravar.length : 0,
    atualizadas: existentes === 0 ? 0 : paraGravar.length,
    removidas: existentes,
    naoImportadas: naoImportadas.length > 0 ? naoImportadas : undefined,
    pesosPorCategoria: [...pesoPorCategoria.entries()].map(([categoria, v]) => ({
      categoria,
      peso: v.peso,
      linhas: v.linhas,
    })),
    categoriasInconsistentes: [...pesoPorCategoria.entries()]
      .filter(([, v]) => v.divergente)
      .map(([categoria]) => categoria),
  };
}
