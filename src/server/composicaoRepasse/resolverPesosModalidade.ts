import type { CategoriaRepasse } from "@prisma/client";
import { prisma } from "../db/prisma";
import { PESOS_MODALIDADE_2026, type PesosModalidade } from "@/calculation-engine/matriculaTotalEqualizada";

export interface PesosModalidadeResolvidos {
  pesos: PesosModalidade;
  /** `cadastrado` = veio de ComposicaoRepasseAnual daquele ano; `fallback` = usou os pesos de 2026. */
  origem: "cadastrado" | "fallback";
  /** Ano cujos pesos foram efetivamente usados (igual ao pedido, ou 2026 no fallback). */
  anoUsado: number;
  /** Mensagem para a memória de cálculo quando houve fallback ou cadastro incompleto. */
  aviso?: string;
}

const ANO_PESOS_PADRAO = 2026;

/**
 * Resolve os quatro pesos por modalidade vigentes num ano-base.
 *
 * A planilha "Composição de Repasse" da CONIF lista uma linha por (Modalidade × Fonte de
 * Financiamento), e todas as linhas de uma mesma categoria compartilham o mesmo peso. Aqui só
 * interessa o peso por categoria, porque as colunas `MT_*` da Matrícula Total equalizada já chegam
 * separadas nos quatro baldes — a classificação linha a linha fica guardada para explicar o
 * resultado ao usuário e para um eventual cálculo próprio do split.
 *
 * Sem cadastro para o ano, cai nos pesos de 2026 e **avisa**: aplicar 2026 a um ciclo posterior daria
 * EAD MOOC dez vezes maior que o correto (0,8 contra 0,08 de 2027), então o fallback nunca deve
 * passar despercebido.
 */
export async function resolverPesosModalidade(ano: number): Promise<PesosModalidadeResolvidos> {
  const linhas = await prisma.composicaoRepasseAnual.findMany({
    where: { ano },
    select: { categoriaRepasse: true, peso: true },
  });

  if (linhas.length === 0) {
    return {
      pesos: PESOS_MODALIDADE_2026,
      origem: "fallback",
      anoUsado: ANO_PESOS_PADRAO,
      // Para o próprio ciclo 2026 o fallback não é uma suposição: são os pesos daquele ano,
      // conferidos contra a planilha-modelo. Só avisa quando o ano pedido é outro, aí sim aplicar
      // 2026 pode estar errado (em 2027 o EAD MOOC é 0,08, dez vezes menor).
      aviso:
        ano === ANO_PESOS_PADRAO
          ? undefined
          : `Não há Composição de Repasse cadastrada para ${ano}; foram usados os pesos do ciclo ` +
            `${ANO_PESOS_PADRAO} (EAD MOOC 0,8). A partir do ciclo 2027 o EAD MOOC correto é 0,08 — ` +
            `cadastre a composição de ${ano} em /admin/composicao-repasse antes de usar este cálculo.`,
    };
  }

  const pesoPorCategoria = new Map<CategoriaRepasse, number>();
  const categoriasInconsistentes = new Set<CategoriaRepasse>();
  for (const linha of linhas) {
    const peso = Number(linha.peso);
    const jaVisto = pesoPorCategoria.get(linha.categoriaRepasse);
    if (jaVisto !== undefined && jaVisto !== peso) {
      categoriasInconsistentes.add(linha.categoriaRepasse);
    }
    pesoPorCategoria.set(linha.categoriaRepasse, peso);
  }

  const faltando: string[] = [];
  const pegar = (categoria: CategoriaRepasse, padrao: number) => {
    const valor = pesoPorCategoria.get(categoria);
    if (valor === undefined) {
      faltando.push(categoria);
      return padrao;
    }
    return valor;
  };

  const pesos: PesosModalidade = {
    presencial: pegar("PRESENCIAL", PESOS_MODALIDADE_2026.presencial),
    ead: pegar("EAD", PESOS_MODALIDADE_2026.ead),
    eadMooc: pegar("EAD_MOOC", PESOS_MODALIDADE_2026.eadMooc),
    eadFp: pegar("EAD_FP", PESOS_MODALIDADE_2026.eadFp),
  };

  const avisos: string[] = [];
  if (faltando.length > 0) {
    avisos.push(
      `A Composição de Repasse de ${ano} não tem nenhuma linha para: ${faltando.join(", ")}. ` +
        `Para essas categorias foram usados os pesos do ciclo ${ANO_PESOS_PADRAO}.`,
    );
  }
  if (categoriasInconsistentes.size > 0) {
    avisos.push(
      `Há pesos divergentes dentro da mesma categoria em ${ano} ` +
        `(${[...categoriasInconsistentes].join(", ")}); foi usado o último valor lido. ` +
        `Confira o cadastro — na planilha oficial todas as linhas de uma categoria têm o mesmo peso.`,
    );
  }

  return {
    pesos,
    origem: "cadastrado",
    anoUsado: ano,
    aviso: avisos.length > 0 ? avisos.join(" ") : undefined,
  };
}
