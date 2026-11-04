/**
 * Alinha os cursos de um câmpus em dois ciclos do Comparativo: a mesma turma fica na mesma linha, e o lado em que ela não existe fica vazio.
 * A chave é o código do ciclo da MDO, estável entre exportações (a turma 2986225 de Venâncio Aires tem esse código em 2026 e em 2027), e não o nome
 * do curso, que se repete a cada turma. Cursos de mesmo nome são agrupados; o período e a modalidade dizem qual é a turma.
 */

export interface TurmaDeEntrada {
  id: number;
  codigoCiclo?: string;
  curso: string;
  repasse: string;
  valor: number;
  inicio: string | null;
  termino: string | null;
  modalidadeRotulo?: string;
}

export interface TurmaComparada {
  chave: string;
  /** Diferencia as turmas de mesmo nome: modalidade, forma de repasse (quando não é presencial) e período. */
  rotulo: string;
  valorA: number | null;
  valorB: number | null;
}

export interface CursoComparado {
  curso: string;
  turmas: TurmaComparada[];
  totalA: number;
  totalB: number;
}

// As datas do ciclo são dias do calendário guardados à meia-noite UTC: no fuso do navegador apareceriam como o dia anterior.
const data = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });
const dia = (iso: string | null) => (iso ? data.format(new Date(iso)) : "sem data");

function rotuloDaTurma(t: TurmaDeEntrada): string {
  const partes = [t.modalidadeRotulo, t.repasse !== "PRESENCIAL" ? t.repasse.replace("_", " ") : null, `${dia(t.inicio)} a ${dia(t.termino)}`];
  return partes.filter(Boolean).join(", ");
}

export function compararCursosEntreCiclos(cursosA: TurmaDeEntrada[], cursosB: TurmaDeEntrada[]): CursoComparado[] {
  const chaveDe = (t: TurmaDeEntrada) => t.codigoCiclo ?? `id-${t.id}`;
  const porChave = new Map<string, { curso: string; inicio: string | null; base: TurmaDeEntrada; valorA: number | null; valorB: number | null }>();
  for (const [lista, lado] of [[cursosA, "valorA"], [cursosB, "valorB"]] as const) {
    for (const t of lista) {
      const atual = porChave.get(chaveDe(t)) ?? { curso: t.curso, inicio: t.inicio, base: t, valorA: null, valorB: null };
      atual[lado] = t.valor;
      porChave.set(chaveDe(t), atual);
    }
  }

  const porCurso = new Map<string, CursoComparado & { inicios: Map<string, string> }>();
  for (const [chave, t] of porChave) {
    const grupo = porCurso.get(t.curso) ?? { curso: t.curso, turmas: [], totalA: 0, totalB: 0, inicios: new Map<string, string>() };
    grupo.turmas.push({ chave, rotulo: rotuloDaTurma(t.base), valorA: t.valorA, valorB: t.valorB });
    grupo.totalA += t.valorA ?? 0;
    grupo.totalB += t.valorB ?? 0;
    grupo.inicios.set(chave, t.inicio ?? "9999");
    porCurso.set(t.curso, grupo);
  }

  return [...porCurso.values()]
    .map(({ inicios, ...g }) => {
      const repetidos = new Set(g.turmas.map((t) => t.rotulo).filter((r, i, todos) => todos.indexOf(r) !== i));
      const turmas = g.turmas
        // Duas turmas do mesmo curso, com a mesma modalidade e o mesmo período: só o código do ciclo as diferencia.
        .map((t) => (repetidos.has(t.rotulo) ? { ...t, rotulo: `${t.rotulo} (ciclo ${t.chave})` } : t))
        .sort((x, y) => (inicios.get(x.chave) ?? "").localeCompare(inicios.get(y.chave) ?? "") || x.chave.localeCompare(y.chave));
      return { ...g, turmas };
    })
    .sort((x, y) => Math.max(y.totalA, y.totalB) - Math.max(x.totalA, x.totalB));
}
