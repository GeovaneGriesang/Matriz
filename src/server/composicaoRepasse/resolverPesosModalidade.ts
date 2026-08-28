import type { CategoriaRepasse } from "@prisma/client";
import { prisma } from "../db/prisma";
import { PESOS_MODALIDADE_PADRAO, type PesosModalidade } from "@/calculation-engine/matriculaTotalEqualizada";

export interface PesosModalidadeResolvidos {
  pesos: PesosModalidade;
  /** `cadastrado` = veio de ComposicaoRepasseAnual daquele ano; `fallback` = usou os pesos padrão. */
  origem: "cadastrado" | "fallback";
  /** Ano cujos pesos foram efetivamente usados (igual ao pedido; ausente no fallback). */
  anoUsado: number | null;
  /** Mensagem para a memória de cálculo quando houve fallback ou cadastro incompleto. */
  aviso?: string;
}

/**
 * Resolve os quatro pesos por modalidade vigentes num ano-base.
 *
 * A planilha "Composição de Repasse" da CONIF lista uma linha por (Modalidade × Fonte de
 * Financiamento), e todas as linhas de uma mesma categoria compartilham o mesmo peso. Aqui só
 * interessa o peso por categoria, porque as colunas `MT_*` da Matrícula Total equalizada já chegam
 * separadas nos quatro baldes — a classificação linha a linha fica guardada para explicar o
 * resultado ao usuário e para um eventual cálculo próprio do split.
 *
 * Sem cadastro para o ano, cai em `PESOS_MODALIDADE_PADRAO` e **avisa**. Esses valores são os mesmos
 * nos ciclos 2026 e 2027 (conferidos nas duas planilhas oficiais), então o fallback tem boa chance de
 * estar certo — mas a CONIF republica a tabela a cada ciclo e nada garante que siga igual, por isso o
 * aviso vai para a memória de cálculo em vez de o sistema seguir em silêncio.
 */
export async function resolverPesosModalidade(ano: number): Promise<PesosModalidadeResolvidos> {
  const linhas = await prisma.composicaoRepasseAnual.findMany({
    where: { ano },
    select: { categoriaRepasse: true, peso: true },
  });

  if (linhas.length === 0) {
    return {
      pesos: PESOS_MODALIDADE_PADRAO,
      origem: "fallback",
      anoUsado: null,
      aviso:
        `Não há Composição de Repasse cadastrada para ${ano}; foram usados os pesos padrão da CONIF ` +
        `(Presencial 1 · EAD 0,25 · EAD MOOC 0,08 · EAD FP 0,8), iguais nos ciclos 2026 e 2027. ` +
        `Importe a composição de ${ano} em /admin/composicao-repasse para confirmar que o ciclo ` +
        `manteve esses pesos.`,
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
    presencial: pegar("PRESENCIAL", PESOS_MODALIDADE_PADRAO.presencial),
    ead: pegar("EAD", PESOS_MODALIDADE_PADRAO.ead),
    eadMooc: pegar("EAD_MOOC", PESOS_MODALIDADE_PADRAO.eadMooc),
    eadFp: pegar("EAD_FP", PESOS_MODALIDADE_PADRAO.eadFp),
  };

  const avisos: string[] = [];
  if (faltando.length > 0) {
    avisos.push(
      `A Composição de Repasse de ${ano} não tem nenhuma linha para: ${faltando.join(", ")}. ` +
        `Para essas categorias foram usados os pesos padrão da CONIF.`,
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
