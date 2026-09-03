"use server";

import { prisma } from "@/server/db/prisma";
import { getAdminSession } from "@/server/auth/session";

export interface SalvarCicloOrcamentoResult {
  ok: boolean;
  errorMessage?: string;
}

/** Os 17 campos numéricos de `CicloOrcamento` que o formulário deixa editar. */
const CAMPOS = [
  "valorReferenciaSpo",
  "ajuste",
  "assistenciaTotal",
  "funcionamentoTotal",
  "pisoTotal",
  "pisoPorCampus",
  "campusComPiso",
  "reitoriasTotal",
  "qualidadeEficienciaTotal",
  "valorIea",
  "valorRap",
  "valorIapl",
  "valorMatriculaPresencial",
  "valorMatriculaEad",
  "valorMatriculaEadFp",
  "valorMatriculaEadMooc",
  "percentualAnuidade",
] as const;

/**
 * Os quatro campos podem ficar em branco no banco (nenhuma exportação de 2026 trouxe
 * valor por matrícula, por exemplo, ver `carregarProposta.ts`); os outros treze são
 * sempre um número, e ficando em branco no formulário viram zero, não nulo.
 */
const OPCIONAIS = new Set([
  "valorMatriculaPresencial",
  "valorMatriculaEad",
  "valorMatriculaEadFp",
  "valorMatriculaEadMooc",
]);

/**
 * Server Action (admin) que corrige à mão os parâmetros de um ciclo orçamentário, para
 * quando a MDO ainda não publicou o dado ou publicou algo que se sabe estar errado
 * (ver, por exemplo, o Piso Mínimo do sistema Matriz, raiz, que soma por cima em vez
 * de reservar do bolo).
 *
 * Salvar aqui SUBSTITUI os 17 campos pelos valores do formulário inteiro (o
 * formulário já vem preenchido com o que está no banco, então editar um campo só
 * não apaga os demais) e cria uma nova `FonteDados` com origem ADMINISTRADOR
 * apontando para este ciclo. Isso é deliberadamente grosseiro: não há rastro de
 * QUAL campo foi corrigido, só de que o ciclo inteiro passou por uma mão humana
 * depois da última carga da MDO. A próxima vez que `npm run carregar` rodar para
 * este ano, a correção é apagada e o valor da MDO volta (o loader sempre faz
 * `deleteMany` antes de recriar, ver `carregarProposta.ts`) — o que é o
 * comportamento certo: a correção manual é uma ponte até a MDO publicar certo, não
 * uma decisão permanente que sobrevive a uma reimportação.
 */
export async function salvarCicloOrcamentoManualAction(formData: FormData): Promise<SalvarCicloOrcamentoResult> {
  if (!(await getAdminSession())) {
    return { ok: false, errorMessage: "Não autenticado." };
  }

  const ano = Number(formData.get("ano"));
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) {
    return { ok: false, errorMessage: "Ano inválido." };
  }

  const existente = await prisma.cicloOrcamento.findUnique({ where: { ano } });
  if (!existente) {
    return { ok: false, errorMessage: `Não há ciclo ${ano} carregado. Corrija um ciclo que já existe.` };
  }

  function ler(campo: (typeof CAMPOS)[number]): number | null {
    const bruto = formData.get(campo);
    if (bruto === null || bruto === "") return null;
    const n = Number(bruto);
    if (!Number.isFinite(n)) throw new Error(campo);
    return n;
  }

  let valores: Record<(typeof CAMPOS)[number], number | null>;
  try {
    valores = Object.fromEntries(CAMPOS.map((campo) => [campo, ler(campo)])) as Record<
      (typeof CAMPOS)[number],
      number | null
    >;
  } catch (erro) {
    return { ok: false, errorMessage: `Valor inválido em ${erro instanceof Error ? erro.message : "um campo"}.` };
  }

  for (const campo of CAMPOS) {
    if (valores[campo] === null && !OPCIONAIS.has(campo)) {
      return { ok: false, errorMessage: `${campo} não pode ficar em branco.` };
    }
  }

  const nomeArquivo = `Correção manual, ciclo ${ano}`;
  const fonte = await prisma.fonteDados.create({
    data: {
      origem: "ADMINISTRADOR",
      cicloOrcamento: ano,
      arquivo: nomeArquivo,
      abrangencia: "REDE",
      ressalva:
        "Estes parâmetros foram corrigidos à mão por um administrador, sobrescrevendo o que a MDO havia " +
        "publicado. Valem até a próxima carga (\"npm run carregar\") deste ciclo, que os substitui de volta " +
        "pelo valor oficial.",
    },
  });

  // Os campos obrigatórios já foram confirmados não-nulos no laço acima; o "!" aqui
  // só declara isso ao TypeScript, que não acompanha essa checagem por fora do laço.
  await prisma.cicloOrcamento.update({
    where: { ano },
    data: {
      fonteDadosId: fonte.id,
      valorReferenciaSpo: valores.valorReferenciaSpo!,
      ajuste: valores.ajuste!,
      assistenciaTotal: valores.assistenciaTotal!,
      funcionamentoTotal: valores.funcionamentoTotal!,
      pisoTotal: valores.pisoTotal!,
      pisoPorCampus: valores.pisoPorCampus!,
      campusComPiso: valores.campusComPiso!,
      reitoriasTotal: valores.reitoriasTotal!,
      qualidadeEficienciaTotal: valores.qualidadeEficienciaTotal!,
      valorIea: valores.valorIea!,
      valorRap: valores.valorRap!,
      valorIapl: valores.valorIapl!,
      valorMatriculaPresencial: valores.valorMatriculaPresencial,
      valorMatriculaEad: valores.valorMatriculaEad,
      valorMatriculaEadFp: valores.valorMatriculaEadFp,
      valorMatriculaEadMooc: valores.valorMatriculaEadMooc,
      percentualAnuidade: valores.percentualAnuidade!,
    },
  });

  return { ok: true };
}
