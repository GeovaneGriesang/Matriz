/**
 * Tabela de peso efetivo: o peso que a MDO realmente aplicou a cada curso, já com o bônus de agropecuária.
 *
 * Ele não vem em coluna nenhuma da exportação. Deduz-se da Matrícula Total publicada: como
 * MT = alunos x ICQA x peso x (CH efetiva / 800) x dias ativos / dias do ciclo, o peso efetivo é
 * MT x 800 / (alunos efetivos x CH efetiva). Para cada (tipo de curso, tipo de oferta, curso, CH mínima do MEC) vale o
 * valor mais frequente entre os ciclos observados (99,77% dos ciclos concordam). Ver `docs/calculo-da-matriz-a-partir-da-pnp.md`.
 *
 * Funções puras: nada aqui lê banco ou arquivo.
 */
import {
  chEfetiva,
  diasAtivosNoPeriodo,
  diasDoCiclo,
  icqaDoCiclo,
  type CicloParaCalculo,
  type PeriodoPnp,
} from "./matriculaTotal";
import { CH_MINIMA_FIC_SEM_CATALOGO, PESO_FIC_SEM_CATALOGO, chaveDoPesoEfetivo, ehQualificacaoProfissional } from "./regrasCiclo";

export type OrigemPesoEfetivo = "DEDUZIDO_DA_MATRICULA_TOTAL" | "REGRA_FIC_SEM_CATALOGO";

export interface CicloObservado {
  tipoCurso: string;
  tipoOferta: string;
  curso: string;
  chMinimaMec: number;
  /** O que a coluna "Peso do Curso" da exportação diz (não é o que a MDO aplicou em ~3% dos ciclos). */
  pesoColuna: number;
  matriculaTotal: number;
  ciclo: CicloParaCalculo;
}

export interface LinhaPesoEfetivo {
  tipoCurso: string;
  tipoOferta: string;
  curso: string;
  chMinimaMec: number;
  pesoEfetivo: number;
  /** Peso mais frequente na coluna "Peso do Curso" para a mesma chave, para mostrar onde a coluna erra. */
  pesoColuna: number;
  ciclosObservados: number;
  ciclosConcordantes: number;
  origem: OrigemPesoEfetivo;
}

/** Curinga das chaves de regra (a regra do FIC vale para qualquer curso e oferta). */
export const QUALQUER = "*";

/** Peso que a MDO aplicou ao ciclo, arredondado em milésimos; null se o ciclo não permite deduzir (sem aluno ativo). */
export function deduzirPesoEfetivo(c: CicloObservado, periodo: PeriodoPnp): number | null {
  const alunos = c.ciclo.alunos;
  const icqa = icqaDoCiclo(c.ciclo, periodo);
  const ativos = diasAtivosNoPeriodo(c.ciclo, periodo);
  if (alunos === 0 || icqa === 0 || ativos === 0) return null;
  const ch = chEfetiva(c.ciclo);
  if (ch <= 0) return null;
  const alunosEfetivos = (alunos * icqa * ativos) / diasDoCiclo(c.ciclo);
  return Math.round(((c.matriculaTotal * 800) / alunosEfetivos / ch) * 1000) / 1000;
}

function maisFrequente<T>(contagem: Map<T, number>): [T, number] {
  let melhor: [T, number] | null = null;
  for (const par of contagem) if (!melhor || par[1] > melhor[1]) melhor = par;
  return melhor as [T, number];
}

/** Consolida os ciclos observados na tabela: uma linha por chave, mais a regra do FIC fora do catálogo. */
export function consolidarTabelaDePeso(ciclos: CicloObservado[], periodo: PeriodoPnp): LinhaPesoEfetivo[] {
  const grupos = new Map<string, { base: CicloObservado; efetivos: Map<number, number>; colunas: Map<number, number>; n: number }>();
  for (const c of ciclos) {
    const efetivo = deduzirPesoEfetivo(c, periodo);
    if (efetivo === null) continue;
    const chave = chaveDoPesoEfetivo(c.tipoCurso, c.tipoOferta, c.curso, c.chMinimaMec);
    const g = grupos.get(chave) ?? { base: c, efetivos: new Map(), colunas: new Map(), n: 0 };
    g.efetivos.set(efetivo, (g.efetivos.get(efetivo) ?? 0) + 1);
    g.colunas.set(c.pesoColuna, (g.colunas.get(c.pesoColuna) ?? 0) + 1);
    g.n++;
    grupos.set(chave, g);
  }

  const linhas: LinhaPesoEfetivo[] = [];
  let ficObservados = 0;
  let ficConcordantes = 0;
  for (const g of grupos.values()) {
    const [pesoEfetivo, concordantes] = maisFrequente(g.efetivos);
    const [pesoColuna] = maisFrequente(g.colunas);
    linhas.push({
      tipoCurso: g.base.tipoCurso,
      tipoOferta: g.base.tipoOferta,
      curso: g.base.curso,
      chMinimaMec: g.base.chMinimaMec,
      pesoEfetivo,
      pesoColuna,
      ciclosObservados: g.n,
      ciclosConcordantes: concordantes,
      origem: "DEDUZIDO_DA_MATRICULA_TOTAL",
    });
    if (ehQualificacaoProfissional(g.base.tipoCurso) && g.base.chMinimaMec === CH_MINIMA_FIC_SEM_CATALOGO) {
      ficObservados += g.n;
      ficConcordantes += g.efetivos.get(PESO_FIC_SEM_CATALOGO) ?? 0;
    }
  }

  // A regra do FIC: curso que a MDO não achou no catálogo (mínima padrão de 3.200 h) vale 2,5, em qualquer curso.
  linhas.push({
    tipoCurso: "QUALIFICACAO PROFISSIONAL (FIC)",
    tipoOferta: QUALQUER,
    curso: QUALQUER,
    chMinimaMec: CH_MINIMA_FIC_SEM_CATALOGO,
    pesoEfetivo: PESO_FIC_SEM_CATALOGO,
    pesoColuna: 1,
    ciclosObservados: ficObservados,
    ciclosConcordantes: ficConcordantes,
    origem: "REGRA_FIC_SEM_CATALOGO",
  });

  return linhas.sort((a, b) => b.ciclosObservados - a.ciclosObservados);
}

/**
 * Peso efetivo de um ciclo pela tabela: procura a chave exata e, não achando, a regra do FIC; sem nenhuma das duas,
 * devolve null (quem chama decide o que fazer: usar a coluna de peso, avisar ou pedir revisão).
 */
export function pesoEfetivoPelaTabela(
  tabela: Pick<LinhaPesoEfetivo, "tipoCurso" | "tipoOferta" | "curso" | "chMinimaMec" | "pesoEfetivo">[],
  tipoCurso: string,
  tipoOferta: string,
  curso: string,
  chMinimaMec: number,
): number | null {
  const exata = chaveDoPesoEfetivo(tipoCurso, tipoOferta, curso, chMinimaMec);
  const achada = tabela.find((l) => chaveDoPesoEfetivo(l.tipoCurso, l.tipoOferta, l.curso, l.chMinimaMec) === exata);
  if (achada) return achada.pesoEfetivo;
  if (ehQualificacaoProfissional(tipoCurso) && chMinimaMec === CH_MINIMA_FIC_SEM_CATALOGO) return PESO_FIC_SEM_CATALOGO;
  return null;
}
