/**
 * Um cenário salvo guarda o curso novo pelo nome, além da posição na tabela de pesos. A posição sozinha não basta: quando a tabela é recarregada, a
 * mesma posição pode apontar para outro curso, e a simulação salva mudaria sem ninguém perceber.
 */

export interface CursoDoCatalogo {
  curso: string;
  tipoCurso: string;
  tipoOferta: string;
  chMinimaMec: number;
}

export interface CursoNovoSalvo {
  catalogoIdx: number;
  cursoDoCatalogo?: CursoDoCatalogo;
}

/** Acrescenta o nome do curso a cada curso novo, para gravar. */
export function comCursoDoCatalogo<T extends CursoNovoSalvo>(novos: T[], catalogo: readonly CursoDoCatalogo[]): T[] {
  return novos.map((n) => {
    const item = n.catalogoIdx >= 0 ? catalogo[n.catalogoIdx] : undefined;
    return item ? { ...n, cursoDoCatalogo: { curso: item.curso, tipoCurso: item.tipoCurso, tipoOferta: item.tipoOferta, chMinimaMec: item.chMinimaMec } } : n;
  });
}

/** Acha de novo a posição de cada curso pelo nome, ao carregar. Curso que saiu da tabela volta a "não escolhido", em vez de virar outro. Cenário antigo, sem o nome, fica como está. */
export function resolverCursosDoCatalogo<T extends CursoNovoSalvo>(novos: T[], catalogo: readonly CursoDoCatalogo[]): T[] {
  return novos.map((n) => {
    const r = n.cursoDoCatalogo;
    if (!r) return n;
    const catalogoIdx = catalogo.findIndex((c) => c.curso === r.curso && c.tipoCurso === r.tipoCurso && c.tipoOferta === r.tipoOferta && c.chMinimaMec === r.chMinimaMec);
    return { ...n, catalogoIdx };
  });
}
