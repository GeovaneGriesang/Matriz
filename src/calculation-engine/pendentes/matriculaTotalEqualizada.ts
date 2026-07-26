import { NotImplementedError } from "../errors/NotImplementedError";

/**
 * "Matrícula Total equalizada" (colunas Q/AI de `COMPLETO PROPOSTA` na planilha oficial) é a base
 * do maior componente da Matriz — o Bloco Funcionamento ("Valor da Matrícula"). NÃO é igual à
 * `Matrícula Equivalente | Geral` de nenhum CSV da PNP disponível hoje, nem à Matrícula-equivalente
 * recalculada com a fórmula oficial (Mateq = Mat × fech × fec, seção 3.2.1) — a razão entre a
 * equalizada da planilha e a Matrícula Equivalente do CSV varia por câmpus (1,37× a 2,6×
 * observado), então nenhuma das duas fontes hoje disponíveis reproduz esse valor.
 *
 * Pendente de confirmação com CONIF/SETEC de onde vem essa equalização extra (possivelmente um
 * fator adicional de duração do ciclo do curso, ou uma seção do Guia de Referência Metodológica da
 * PNP não disponível publicamente) — ver seção 9, item 2, de
 * docs/pnp-matriz/Metodologia_Matriz_Orcamentaria_CONIF.md.
 *
 * NÃO implementar uma aproximação aqui. Enquanto isso não for confirmado, o Bloco Funcionamento
 * continua usando `Matrícula Equivalente | Geral` como placeholder (ver o aviso emitido em
 * runCalculation.ts) — não chamar esta função em produção.
 */
export function calcularMatriculaTotalEqualizada(_campusId: number, _matriculaEquivalente: number): number {
  throw new NotImplementedError(
    "Pendente de confirmação com CONIF/SETEC — ver seção 9 de Metodologia_Matriz_Orcamentaria_CONIF.md. Não implementar sem a fórmula oficial confirmada.",
  );
}
