/**
 * Marcar pessoas numa lista (o compartilhamento): todos, nenhum, inverter. As operações valem para o que está VISÍVEL (a lista filtrada
 * pela busca) e deixam intactas as pessoas já marcadas que a busca esconde, para uma busca não desmarcar sem querer quem estava fora dela.
 * Funções puras.
 */

export function marcarTodos(selecionados: ReadonlySet<number>, visiveis: readonly number[]): Set<number> {
  const novo = new Set(selecionados);
  for (const id of visiveis) novo.add(id);
  return novo;
}

export function desmarcarTodos(selecionados: ReadonlySet<number>, visiveis: readonly number[]): Set<number> {
  const novo = new Set(selecionados);
  for (const id of visiveis) novo.delete(id);
  return novo;
}

export function inverterSelecao(selecionados: ReadonlySet<number>, visiveis: readonly number[]): Set<number> {
  const novo = new Set(selecionados);
  for (const id of visiveis) {
    if (novo.has(id)) novo.delete(id);
    else novo.add(id);
  }
  return novo;
}

export function alternar(selecionados: ReadonlySet<number>, id: number): Set<number> {
  const novo = new Set(selecionados);
  if (novo.has(id)) novo.delete(id);
  else novo.add(id);
  return novo;
}

/** O que mudou em relação ao que já estava compartilhado, para mostrar "3 novos, 1 removido" antes de confirmar. */
export function diferencaDeCompartilhamento(antes: readonly number[], depois: ReadonlySet<number>): { adicionados: number[]; removidos: number[] } {
  const a = new Set(antes);
  return { adicionados: [...depois].filter((id) => !a.has(id)), removidos: [...a].filter((id) => !depois.has(id)) };
}
