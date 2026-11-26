/**
 * Por que o valor de um câmpus sobe ou desce de um ano da matriz para o seguinte, na tela de Cenários.
 *
 * A projeção soma turmas: as de hoje, as que entram no lugar delas (reposição) e as dos cursos novos. Comparando cada turma num ano e
 * no anterior, a diferença tem sempre uma de poucas causas, e é isso que a tela mostra, em vez de só o total:
 *  - a turma terminou no ano anterior: os alunos se formaram e só os retidos seguem contando;
 *  - a turma já tinha terminado antes: são retidos que deixam a matrícula (ou passam do prazo de jubilamento);
 *  - a turma está em andamento: perde alunos pela evasão, ou, ao contrário, conta o ano inteiro pela primeira vez (entrou no meio do ano anterior);
 *  - a turma não existia no ano anterior: entrou agora, como reposição de um curso que continua, curso novo ou curso reformulado.
 * A soma das causas é exatamente a variação do total.
 */

export type Origem = "hoje" | "reposicao" | "novo" | "reformulado";

export type Motivo = "formaram" | "retidos" | "evasao" | "anoCompleto" | "reposicao" | "novos" | "reformulados" | "mooc";

export const MOTIVOS: { chave: Motivo; rotulo: string; explicacao: string }[] = [
  { chave: "formaram", rotulo: "Turmas que se formaram", explicacao: "Turmas que terminaram no ano anterior: os alunos se formam e só os retidos seguem contando." },
  { chave: "retidos", rotulo: "Retidos que saem", explicacao: "Alunos de turmas já terminadas que deixam a matrícula ou passam do prazo de jubilamento." },
  { chave: "evasao", rotulo: "Evasão nas turmas em andamento", explicacao: "Alunos que saem das turmas que ainda não terminaram (e o último ano, quando a turma acaba no meio dele)." },
  { chave: "anoCompleto", rotulo: "Turmas recentes contam o ano inteiro", explicacao: "Turma que entrou no meio do ano anterior conta só os meses em que existiu; no ano seguinte, conta o ano inteiro." },
  { chave: "reposicao", rotulo: "Turmas novas dos cursos que continuam", explicacao: "A turma que entra no lugar da que terminou, nos cursos que seguem sendo ofertados." },
  { chave: "novos", rotulo: "Turmas de cursos novos", explicacao: "A primeira e as seguintes turmas dos cursos novos do cenário." },
  { chave: "reformulados", rotulo: "Turmas de cursos reformulados", explicacao: "Turmas do currículo novo de um curso que já existia, informado como reformulado." },
  { chave: "mooc", rotulo: "Ajuste do MOOC fixo", explicacao: "A diferença para manter os alunos MOOC no número escolhido." },
];

export interface TurmaNoTempo {
  /** O curso a que a turma pertence, para mostrar quem ganha e quem perde. */
  curso: string;
  origem: Origem;
  /** Ano civil em que a turma termina. */
  anoTermino: number;
  /** Valor da turma em cada ano do horizonte, na medida da tabela. */
  valores: number[];
}

export type Decomposicao = Record<Motivo, number>;

const ZERO = 1e-9;

export function decomposicaoVazia(): Decomposicao {
  return { formaram: 0, retidos: 0, evasao: 0, anoCompleto: 0, reposicao: 0, novos: 0, reformulados: 0, mooc: 0 };
}

/** A causa da variação de uma turma entre o ano `k - 1` e o ano `k` (ano-base `anoBase`). */
export function motivoDaTurma(t: TurmaNoTempo, k: number, anoBase: number): Motivo | null {
  const antes = t.valores[k - 1] ?? 0;
  const depois = t.valores[k] ?? 0;
  if (Math.abs(depois - antes) < ZERO) return null;
  if (Math.abs(antes) < ZERO) return t.origem === "novo" ? "novos" : t.origem === "reformulado" ? "reformulados" : "reposicao";
  if (t.anoTermino === anoBase - 1) return "formaram";
  if (t.anoTermino < anoBase - 1) return "retidos";
  return depois < antes ? "evasao" : "anoCompleto";
}

export interface VariacaoDoAno {
  k: number;
  antes: number;
  depois: number;
  porMotivo: Decomposicao;
  /** Por motivo, o que cada curso contribuiu (para listar os maiores ganhos e perdas). */
  porCurso: Map<string, Decomposicao>;
}

/** A variação de cada ano em relação ao anterior, decomposta pelas causas. `ajusteMooc[k]` é o ajuste do MOOC fixo no ano `k`. */
export function decomporVariacoes(turmas: TurmaNoTempo[], anos: number, anoBase0: number, ajusteMooc: number[] = []): VariacaoDoAno[] {
  const total = (k: number) => turmas.reduce((s, t) => s + (t.valores[k] ?? 0), 0) + (ajusteMooc[k] ?? 0);
  const resultado: VariacaoDoAno[] = [];
  for (let k = 1; k < anos; k++) {
    const porMotivo = decomposicaoVazia();
    const porCurso = new Map<string, Decomposicao>();
    for (const t of turmas) {
      const m = motivoDaTurma(t, k, anoBase0 + k);
      if (!m) continue;
      const d = (t.valores[k] ?? 0) - (t.valores[k - 1] ?? 0);
      porMotivo[m] += d;
      const c = porCurso.get(t.curso) ?? decomposicaoVazia();
      c[m] += d;
      porCurso.set(t.curso, c);
    }
    porMotivo.mooc = (ajusteMooc[k] ?? 0) - (ajusteMooc[k - 1] ?? 0);
    resultado.push({ k, antes: total(k - 1), depois: total(k), porMotivo, porCurso });
  }
  return resultado;
}

export const somaDecomposicao = (d: Decomposicao) => Object.values(d).reduce((s, v) => s + v, 0);
