import { ehQualificacaoProfissional } from "@/lib/mdo/regrasCiclo";

/**
 * Os filtros da tela de Cenários: quais turmas entram na conta. Valem nos totais depois de projetar, e não antes, para que a reposição de um
 * curso continue medida com todas as turmas dele.
 */
export const GRUPOS_MODALIDADE = [
  { valor: "PRESENCIAL", rotulo: "Presencial" },
  { valor: "EAD_FP", rotulo: "A distância, financiamento próprio" },
  { valor: "EAD", rotulo: "A distância, financiamento externo" },
  { valor: "EAD_MOOC", rotulo: "MOOC" },
] as const;

export const GRUPOS_TIPO = [
  { valor: "TECNICO", rotulo: "Técnico" },
  { valor: "GRADUACAO", rotulo: "Graduação" },
  { valor: "POS", rotulo: "Pós-graduação" },
  { valor: "FIC", rotulo: "Qualificação (FIC)" },
  { valor: "FIC_EJA", rotulo: "Qualificação no Proeja (EJA)" },
  { valor: "BASICA", rotulo: "Educação básica" },
] as const;

export const GRUPOS_OFERTA = [
  { valor: "INTEGRADO", rotulo: "Integrado" },
  { valor: "SUBSEQUENTE", rotulo: "Subsequente" },
  { valor: "CONCOMITANTE", rotulo: "Concomitante" },
  { valor: "PROEJA", rotulo: "Proeja" },
  { valor: "NAO_SE_APLICA", rotulo: "Não se aplica" },
] as const;

export const GRUPOS_FINANCIAMENTO = [
  { valor: "SEM_PROGRAMA", rotulo: "Sem programa associado" },
  { valor: "COM_PROGRAMA", rotulo: "Com programa (UAB, MOOC, Proeja e outros)" },
] as const;

export const GRUPOS_SITUACAO = [
  { valor: "EM_DIA", rotulo: "Turmas em andamento" },
  { valor: "RETIDA", rotulo: "Turmas já encerradas, com alunos retidos" },
] as const;

const valores = <T extends readonly { valor: string }[]>(g: T) => g.map((x) => x.valor) as T[number]["valor"][];

export interface FiltrosCenario {
  modalidade: string[];
  tipo: string[];
  oferta: string[];
  financiamento: string[];
  situacao: string[];
}

/** Sem filtro: tudo marcado. */
export const FILTROS_TODOS: FiltrosCenario = {
  modalidade: valores(GRUPOS_MODALIDADE),
  tipo: valores(GRUPOS_TIPO),
  oferta: valores(GRUPOS_OFERTA),
  financiamento: valores(GRUPOS_FINANCIAMENTO),
  situacao: valores(GRUPOS_SITUACAO),
};

/** Presenciais e regulares, como definido pelo usuário em 2026-11-05: integrado, concomitante, subsequente, EJA, superiores e pós-graduações. Só o FIC comum fica de fora. */
export const FILTROS_PRESENCIAIS_REGULARES: FiltrosCenario = { ...FILTROS_TODOS, modalidade: ["PRESENCIAL"], tipo: ["TECNICO", "GRADUACAO", "POS", "BASICA", "FIC_EJA"] };

export function grupoDoTipoDeCurso(tipoCurso: string, tipoOferta = ""): string {
  const t = tipoCurso.toUpperCase();
  if (ehQualificacaoProfissional(t)) return tipoOferta.toUpperCase().startsWith("PROEJA") ? "FIC_EJA" : "FIC";
  if (t.startsWith("TECNICO") || t.startsWith("ESPECIALIZACAO TECNICA")) return "TECNICO";
  if (t.startsWith("BACHARELADO") || t.startsWith("LICENCIATURA") || t.startsWith("TECNOLOGIA") || t === "ABI") return "GRADUACAO";
  if (t.startsWith("ESPECIALIZACAO") || t.startsWith("MESTRADO") || t.startsWith("DOUTORADO")) return "POS";
  return "BASICA";
}

export function grupoDaOferta(tipoOferta: string): string {
  const o = tipoOferta.toUpperCase();
  if (o.startsWith("PROEJA")) return "PROEJA";
  if (o.startsWith("INTEGRADO")) return "INTEGRADO";
  if (o.startsWith("SUBSEQUENTE")) return "SUBSEQUENTE";
  if (o.startsWith("CONCOMITANTE")) return "CONCOMITANTE";
  return "NAO_SE_APLICA";
}

export function grupoDoFinanciamento(fonteFinanciamento: string): string {
  return fonteFinanciamento.toUpperCase().startsWith("SEM PROGRAMA") ? "SEM_PROGRAMA" : "COM_PROGRAMA";
}

export interface TurmaFiltravel {
  repasse: string;
  tipoCurso: string;
  tipoOferta: string;
  fonteFinanciamento: string;
  /** A turma já tinha terminado antes do ano-base: o que resta são alunos retidos. */
  retida: boolean;
}

export function passaNoFiltro(t: TurmaFiltravel, f: FiltrosCenario): boolean {
  return (
    f.modalidade.includes(t.repasse) &&
    f.tipo.includes(grupoDoTipoDeCurso(t.tipoCurso, t.tipoOferta)) &&
    f.oferta.includes(grupoDaOferta(t.tipoOferta)) &&
    f.financiamento.includes(grupoDoFinanciamento(t.fonteFinanciamento)) &&
    f.situacao.includes(t.retida ? "RETIDA" : "EM_DIA")
  );
}

export function filtroAtivo(f: FiltrosCenario): boolean {
  return (Object.keys(FILTROS_TODOS) as (keyof FiltrosCenario)[]).some((k) => FILTROS_TODOS[k].some((v) => !f[k].includes(v)));
}

/** Confere os filtros de um cenário salvo. Cenário antigo não tem filtros, e cenário de outra versão não pode quebrar a tela: o que faltar fica marcado. */
export function normalizarFiltros(bruto: unknown): FiltrosCenario {
  const b = (bruto && typeof bruto === "object" ? bruto : {}) as Partial<Record<keyof FiltrosCenario, unknown>>;
  const grupo = (k: keyof FiltrosCenario) => {
    const lista = b[k];
    return Array.isArray(lista) ? FILTROS_TODOS[k].filter((v) => lista.includes(v)) : [...FILTROS_TODOS[k]];
  };
  return { modalidade: grupo("modalidade"), tipo: grupo("tipo"), oferta: grupo("oferta"), financiamento: grupo("financiamento"), situacao: grupo("situacao") };
}

/** Em que unidade a tabela do cenário mostra os números. */
export const MEDIDAS = [
  { valor: "reais", rotulo: "Matriz projetada (R$)", noTexto: "reais (matriz projetada)" },
  { valor: "alunos", rotulo: "Matrícula projetada (alunos)", noTexto: "alunos (matrícula projetada)" },
  { valor: "contados", rotulo: "Alunos que a MDO conta", noTexto: "alunos que a MDO conta" },
  { valor: "mateq", rotulo: "Matrícula equivalente", noTexto: "matrícula equivalente" },
] as const;
export type Medida = (typeof MEDIDAS)[number]["valor"];

export const ehMedida = (v: unknown): v is Medida => MEDIDAS.some((m) => m.valor === v);

/** O número de um ponto da projeção na medida escolhida. `fatorMateq` é o Mat x fech x fec de um aluno daquela turma. */
export function valorNaMedida(medida: Medida, ponto: { valor: number; alunos: number; alunosContados: number }, fatorMateq: number): number {
  if (medida === "reais") return ponto.valor;
  if (medida === "alunos") return ponto.alunos;
  if (medida === "contados") return ponto.alunosContados;
  return ponto.alunos * fatorMateq;
}
