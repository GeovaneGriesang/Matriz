"use client";

import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { ContextoDaTela } from "@/components/chat/ChatDaTela";
import { useConfiguracaoSalvavel } from "@/components/configuracoes/ConfiguracoesSalvas";
import { PESO_REPASSE_PADRAO, type Repasse } from "@/lib/mdo/matriculaTotal";
import { VAGAS_POR_ANO_PADRAO } from "@/lib/mdo/padroesCurso";
import { chDaMatrizDoCurso } from "@/lib/mdo/valorDoCurso";
import {
  projetarMatriculados,
  situacaoDoCiclo,
  turmasDeCursoNovo,
  turmasDeReposicaoDoConjunto,
  ultimoAnoDeTermino,
  type CicloProjetavel,
  type CursoNovo,
  type Premissas,
  type TurmaProjetada,
} from "@/lib/mdo/projecaoCiclos";
import { comCursoDoCatalogo, resolverCursosDoCatalogo, type CursoDoCatalogo } from "@/lib/cenarioProjecao";
import { FILTROS_TODOS, MEDIDAS, ehMedida, filtroAtivo, normalizarFiltros, passaNoFiltro, valorNaMedida, type FiltrosCenario, type Medida, type TurmaFiltravel } from "@/lib/filtrosCenario";
import { fatorMatriculaEquivalente } from "@/lib/mdo/matriculaEquivalente";
import { FiltrosDoCenario } from "@/components/simulador/FiltrosDoCenario";
import { rotuloDoCiclo } from "@/lib/identificacaoCiclo";
import { SinalMaisMenos } from "@/components/SinalMaisMenos";
import { ajusteParaManterMooc, repartirMooc, type MoocDoAno } from "@/lib/mdo/manterMooc";
import { decomporVariacoes, type TurmaNoTempo } from "@/lib/mdo/porQueMuda";
import { PorQueMuda } from "@/components/simulador/PorQueMuda";
import { CONFIG_DISTRIBUICAO_PADRAO, DistribuicaoProjetada, normalizarConfigDaDistribuicao, type ConfigDaDistribuicao } from "@/components/simulador/DistribuicaoProjetada";

/** Um ciclo como vem do servidor: datas em texto, porque Date não atravessa para o componente de cliente. */
export interface CicloSerial {
  id: number;
  codigoCiclo?: string;
  unidadeId: number;
  curso: string;
  tipoCurso: string;
  tipoOferta: string;
  repasse: Repasse;
  inicio: string;
  termino: string;
  jubilamento: string;
  chCiclo: number;
  chMec: number;
  chMatriz: number;
  peso: number;
  agropecuaria: boolean;
  alunos: number;
  valorPorMT: number;
  fonteFinanciamento: string;
  /** Quanto um aluno desta turma vale em matrícula equivalente (fech x fec). */
  fatorMateq: number;
  /** Falso quando a PNP não trouxe a turma e o fec é o padrão do tipo de curso. */
  fatorDaPnp: boolean;
}

/** Uma linha da tabela de pesos: o que o catálogo sabe de um curso, para abrir um curso novo no cenário. */
export interface ItemCatalogo {
  curso: string;
  tipoCurso: string;
  tipoOferta: string;
  chMinimaMec: number;
  pesoEfetivo: number;
  /** O fator de esforço do curso, da PNP; sem dado, o padrão do tipo de curso. */
  fatorEsforco: number;
}

export interface TaxasPadrao {
  presencial: number;
  ead: number;
  /** De onde vieram, em uma frase. */
  origem: string;
  porAno: Array<{ anoBase: number; presencial: number | null; ead: number | null }>;
  /** Verdadeiro quando a PNP não tinha o dado e a tela usou um valor de partida qualquer. */
  semDado: boolean;
}

export interface RetencaoPadrao {
  /** Fração dos alunos do término ainda matriculados 1, 2 e 3 anos depois. */
  retencao: number[];
  /** Verdadeiro quando foi medida nos ciclos da instituição; falso quando é o valor de partida. */
  observada: boolean;
  alunosNoTermino: number;
}

/** Um curso novo do cenário, como a pessoa o preenche. */
interface NovoCursoUI {
  id: number;
  unidadeId: number;
  /** Posição no catálogo; -1 enquanto a pessoa não escolheu o curso. */
  catalogoIdx: number;
  /** O curso pelo nome: é o que vale ao carregar, porque a posição muda quando a tabela de pesos é recarregada. */
  cursoDoCatalogo?: CursoDoCatalogo;
  busca: string;
  anoInicio: number;
  mes: number;
  /** Turmas por ano: 1 (curso anual) ou 2 (semestral). */
  entradas?: 1 | 2;
  anoFim: number;
  /** O curso continua sendo ofertado, com uma turma nova a cada entrada, até o fim do horizonte (o normal de um curso aberto). Cenários salvos antes não têm o campo e seguem valendo pelo "último ano" que a pessoa informou. */
  continua?: boolean;
  ingressantes: number;
  duracao: number;
  repasse: Repasse;
  /** Reformulação de um curso que o câmpus já oferta (currículo novo): as turmas contam como continuidade, na Reposição, e não como curso novo. */
  reformulado?: boolean;
  /** O curso de hoje que a reformulação substitui (chave câmpus|curso|oferta): ele deixa de receber turma a partir da primeira turma do currículo novo. */
  substitui?: string;
}

interface CenarioSalvo {
  v: 1;
  anos: number;
  evPresencial: number;
  evEad: number;
  reporExistentes: boolean;
  encerramentos: Record<string, number>;
  novos: NovoCursoUI[];
  /** O câmpus em exame (null = a instituição inteira). */
  campusId?: number | null;
  /** Cenários salvos antes de 2026-11-05 não têm os dois campos: valem todas as turmas, em reais. */
  filtros?: FiltrosCenario;
  medida?: Medida;
  /** Manter os alunos MOOC num número fixo por câmpus (chave: id do câmpus). Cenários salvos antes de 2026-11-23 não têm o campo. */
  mooc?: MoocFixo;
  /** O que a pessoa mudou na distribuição entre os câmpus (total, parte da Matriz 3, alunos). Cenários salvos antes de 2026-11-26 não têm o campo. */
  distribuicao?: ConfigDaDistribuicao;
}

/** A distribuição interna do IFSul: o que cada câmpus recebeu no ano anterior à matriz e o valor oficial do ano da matriz, pelo id do câmpus. */
export interface DadosDaDistribuicaoInterna {
  campi: Array<{ id: number; nome: string }>;
  anterior: Record<string, number>;
  oficial: Record<string, number> | null;
}

interface MoocFixo {
  manter: boolean;
  /** Alunos MOOC por ano em cada câmpus; o câmpus sem número fica com os alunos MOOC de hoje. */
  alunos: Record<string, number>;
}
const MOOC_LIVRE: MoocFixo = { manter: false, alunos: {} };

function normalizarMooc(bruto: unknown): MoocFixo {
  const b = (bruto && typeof bruto === "object" ? bruto : {}) as Partial<MoocFixo>;
  const alunos: Record<string, number> = {};
  if (b.alunos && typeof b.alunos === "object") for (const [k, v] of Object.entries(b.alunos)) if (typeof v === "number" && Number.isFinite(v) && v >= 0) alunos[k] = v;
  return { manter: b.manter === true, alunos };
}

const MAX_ANOS = 20;
const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pct = (x: number) => `${decimal.format(x * 100)}%`;
const comSinal = (v: number) => (Math.abs(v) < 1 ? reais.format(0) : `${v > 0 ? "+" : "-"}${reais.format(Math.abs(v))}`);

const ROTULO_REPASSE: Record<Repasse, string> = {
  PRESENCIAL: "Presencial",
  EAD_FP: "A distância, financiamento próprio (80%)",
  EAD: "A distância, financiamento externo (25%)",
  EAD_MOOC: "A distância, MOOC (8%)",
};

const campo = "w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900";

function paraCiclo(c: CicloSerial): CicloProjetavel & Pick<CicloSerial, "fonteFinanciamento" | "fatorMateq" | "fatorDaPnp"> {
  return { ...c, inicio: new Date(c.inicio), termino: new Date(c.termino), jubilamento: new Date(c.jubilamento) };
}

const chaveDoCurso = (unidadeId: number, curso: string, oferta: string) => `${unidadeId}|${curso}|${oferta}`;

/** Duração típica de um tipo de curso quando não há ciclo parecido para medir. */
function duracaoPadrao(tipoCurso: string, tipoOferta: string): number {
  const t = tipoCurso.toUpperCase();
  const o = tipoOferta.toUpperCase();
  if (t.startsWith("QUALIFICA")) return 0.25;
  if (o.includes("PROEJA")) return 3;
  if (o.includes("INTEGRADO")) return 3;
  if (o.includes("SUBSEQUENTE") || o.includes("CONCOMITANTE")) return 2;
  if (t.includes("TECNOLOGIA")) return 3;
  if (t.includes("ESPECIALIZA")) return 1.5;
  if (t.includes("MESTRADO")) return 2;
  if (t.includes("DOUTORADO")) return 4;
  if (t.includes("LICENCIATURA") || t.includes("BACHARELADO")) return 4;
  return 3;
}

function mediana(v: number[]): number {
  const o = [...v].sort((a, b) => a - b);
  return o.length === 0 ? 0 : o[Math.floor(o.length / 2)]!;
}

interface LinhaAno {
  matric: number;
  repos: number;
  reposTudo: number;
  novos: number;
  alunos: number;
  /** A parte da reposição que vem de manter o MOOC no número escolhido (já somada em `repos`). */
  ajusteMooc: number;
}
const linhasVazias = (n: number): LinhaAno[] => Array.from({ length: n }, () => ({ matric: 0, repos: 0, reposTudo: 0, novos: 0, alunos: 0, ajusteMooc: 0 }));

export function ProjecaoCiclos({
  seletorInstituicao,
  instituicao,
  anoCiclo,
  anoBase0,
  campi,
  ciclos,
  catalogo,
  valorMatriculaPresencial,
  taxasPadrao,
  retencao,
  campusInicialId,
  distribuicaoInterna,
}: {
  instituicao: string;
  anoCiclo: number;
  anoBase0: number;
  campi: Array<{ id: number; nome: string }>;
  /** A lista de instituições, montada no servidor, para ficar junto da escolha do câmpus. */
  seletorInstituicao: ReactNode;
  ciclos: CicloSerial[];
  catalogo: ItemCatalogo[];
  valorMatriculaPresencial: number;
  taxasPadrao: TaxasPadrao;
  retencao: RetencaoPadrao;
  campusInicialId: number | null;
  /** Só para o IFSul: a base da distribuição entre os câmpus. */
  distribuicaoInterna?: DadosDaDistribuicaoInterna | null;
}) {
  const [campusId, setCampusId] = useState<number | null>(campusInicialId);
  const [anos, setAnos] = useState(5);
  const [evPresencial, setEvPresencial] = useState(Math.round(taxasPadrao.presencial * 1000) / 10);
  const [evEad, setEvEad] = useState(Math.round(taxasPadrao.ead * 1000) / 10);
  const [reporExistentes, setReporExistentes] = useState(true);
  const [encerramentos, setEncerramentos] = useState<Record<string, number>>({});
  const [novos, setNovos] = useState<NovoCursoUI[]>([]);
  const [filtroCurso, setFiltroCurso] = useState("");
  const [verTodosOsCursos, setVerTodosOsCursos] = useState(false);
  const [restaurado, setRestaurado] = useState(false);
  const [filtros, setFiltros] = useState<FiltrosCenario>(FILTROS_TODOS);
  const [medida, setMedida] = useState<Medida>("reais");
  const [mooc, setMooc] = useState<MoocFixo>(MOOC_LIVRE);
  const [distribuicao, setDistribuicao] = useState<ConfigDaDistribuicao>(CONFIG_DISTRIBUICAO_PADRAO);
  // O ano aberto pelo + da tabela do cenário (posição na tabela), para ver de onde vêm os alunos daquele ano.
  const [anoAberto, setAnoAberto] = useState<number | null>(null);
  // O formulário de curso novo aberto: id null para um curso que ainda não está na tabela. As mudanças só valem ao salvar.
  const [formulario, setFormulario] = useState<{ id: number | null; dados: NovoCursoUI } | null>(null);
  const [detalheCompleto, setDetalheCompleto] = useState(false);

  const chaveSalva = `matriz.cenario.${instituicao}.${anoCiclo}`;

  /** Aplica um cenário (do navegador ou salvo no servidor), conferindo cada campo: um cenário antigo ou de outra versão não pode quebrar a tela. */
  function aplicarCenario(bruto: unknown) {
    const c = bruto as Partial<CenarioSalvo> | null;
    if (!c || c.v !== 1) return;
    if (typeof c.anos === "number") setAnos(Math.min(MAX_ANOS, Math.max(1, Math.round(c.anos))));
    if (typeof c.evPresencial === "number") setEvPresencial(Math.min(80, Math.max(0, c.evPresencial)));
    if (typeof c.evEad === "number") setEvEad(Math.min(80, Math.max(0, c.evEad)));
    setReporExistentes(c.reporExistentes !== false);
    setEncerramentos(c.encerramentos && typeof c.encerramentos === "object" ? c.encerramentos : {});
    setNovos(resolverCursosDoCatalogo((Array.isArray(c.novos) ? c.novos : []).filter((n) => campi.some((x) => x.id === n.unidadeId)), catalogo));
    if (c.campusId !== undefined) setCampusId(c.campusId !== null && campi.some((x) => x.id === c.campusId) ? c.campusId : null);
    setFiltros(normalizarFiltros(c.filtros));
    setMedida(ehMedida(c.medida) ? c.medida : "reais");
    setMooc(normalizarMooc(c.mooc));
    setDistribuicao(normalizarConfigDaDistribuicao(c.distribuicao));
  }

  // O cenário fica guardado neste navegador, para a pessoa voltar e continuar de onde parou.
  useEffect(() => {
    try {
      const bruto = window.localStorage.getItem(chaveSalva);
      if (bruto) aplicarCenario(JSON.parse(bruto));
    } catch {
      /* navegador sem armazenamento: o cenário só vale enquanto a página estiver aberta */
    }
    setRestaurado(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveSalva, campi]);

  useEffect(() => {
    if (!restaurado) return;
    try {
      const s: CenarioSalvo = { v: 1, anos, evPresencial, evEad, reporExistentes, encerramentos, novos: comCursoDoCatalogo(novos, catalogo), campusId, filtros, medida, mooc, distribuicao };
      window.localStorage.setItem(chaveSalva, JSON.stringify(s));
    } catch {
      /* idem */
    }
  }, [restaurado, chaveSalva, anos, evPresencial, evEad, reporExistentes, encerramentos, novos, campusId, catalogo, filtros, medida, mooc, distribuicao]);

  // As simulações salvas no servidor (com nome, para compartilhar) usam o mesmo estado.
  useConfiguracaoSalvavel({
    chave: `simulador/projecao:${instituicao}:${anoCiclo}`,
    rotulo: "esta simulação",
    capturar: () => ({ v: 1, anos, evPresencial, evEad, reporExistentes, encerramentos, novos: comCursoDoCatalogo(novos, catalogo), campusId, filtros, medida, mooc, distribuicao }) satisfies CenarioSalvo,
    aplicar: aplicarCenario,
  });

  const premissas = useMemo<Premissas>(
    () => ({ evasao: { presencial: evPresencial / 100, ead: evEad / 100 }, retencao: retencao.retencao }),
    [evPresencial, evEad, retencao],
  );
  const todos = useMemo(() => ciclos.map(paraCiclo), [ciclos]);

  const turmaPassa = useMemo(() => {
    const inicioDoAnoBase = Date.UTC(anoBase0, 0, 1);
    return todos.map((c) => passaNoFiltro({ ...c, retida: c.termino.getTime() < inicioDoAnoBase }, filtros));
  }, [todos, filtros, anoBase0]);

  // Os cálculos pesados (um por ciclo) só são refeitos quando muda o horizonte ou a evasão; mexer no cenário só refaz as somas.
  const matriculadosPorCiclo = useMemo(() => todos.map((c) => projetarMatriculados(c, anoBase0, anos, premissas)), [todos, anoBase0, anos, premissas]);
  const turmasPorCiclo = useMemo<TurmaProjetada[][]>(() => turmasDeReposicaoDoConjunto(todos, anoBase0, anos, premissas), [todos, anoBase0, anos, premissas]);

  // Cursos novos: o que o catálogo sabe de cada um vira a especificação que o motor usa.
  const novosEspec = useMemo(
    () =>
      novos.map((n) => {
        const item = n.catalogoIdx >= 0 ? catalogo[n.catalogoIdx] : undefined;
        if (!item) return { ui: n, item: undefined, spec: undefined, filtravel: undefined, fatorMateq: 0 };
        const chMatriz = chDaMatrizDoCurso(item.tipoCurso, item.tipoOferta, item.chMinimaMec);
        const spec: CursoNovo = {
          tipoCurso: item.tipoCurso,
          repasse: n.repasse,
          peso: item.pesoEfetivo,
          chMatriz,
          valorPorMT: valorMatriculaPresencial * PESO_REPASSE_PADRAO[n.repasse],
          primeiroAnoEntrada: n.anoInicio,
          ultimoAnoEntrada: n.continua === true ? anoBase0 + anos - 1 : Math.max(n.anoInicio, n.anoFim),
          mesInicio: n.mes,
          entradasPorAno: n.entradas === 2 ? 2 : 1,
          ingressantes: Math.max(0, n.ingressantes),
          duracaoAnos: Math.max(0.1, n.duracao),
        };
        const filtravel: TurmaFiltravel = { repasse: n.repasse, tipoCurso: item.tipoCurso, tipoOferta: item.tipoOferta, fonteFinanciamento: "SEM PROGRAMA ASSOCIADO", retida: false };
        const fatorMateq = fatorMatriculaEquivalente({ tipoCurso: item.tipoCurso, fatorEsforco: item.fatorEsforco, cargaHoraria: chMatriz });
        return { ui: n, item, spec, filtravel, fatorMateq };
      }),
    [novos, catalogo, valorMatriculaPresencial, anoBase0, anos],
  );
  const turmasDosNovos = useMemo(
    () => novosEspec.map((e) => (e.spec ? turmasDeCursoNovo(e.spec, anoBase0, anos, premissas) : [])),
    [novosEspec, anoBase0, anos, premissas],
  );

  // As paradas que valem na conta: as digitadas e, para cada curso reformulado, o curso antigo que ele substitui, a partir da primeira turma do currículo novo.
  const paradasEfetivas = useMemo(() => {
    const p: Record<string, number> = { ...encerramentos };
    for (const n of novos) {
      if (!n.reformulado || !n.substitui) continue;
      p[n.substitui] = Math.min(p[n.substitui] ?? Infinity, n.anoInicio);
    }
    return p;
  }, [encerramentos, novos]);
  const substituidoPor = useMemo(() => {
    const m = new Map<string, NovoCursoUI>();
    for (const n of novos) if (n.reformulado && n.substitui) m.set(n.substitui, n);
    return m;
  }, [novos]);

  // Soma por câmpus, ano a ano: quem já está matriculado, a reposição dos cursos que continuam, os cursos novos.
  // Os cartões ficam sempre em reais; a tabela segue a medida escolhida. Uma turma fora do filtro não entra em nenhuma parcela, nem em "manter tudo".
  const somarPorCampus = (qual: Medida, passa: readonly boolean[] = turmaPassa, filtrosDaSoma: FiltrosCenario = filtros) => {
    const m = new Map<number, LinhaAno[]>();
    const linhasDe = (u: number) => {
      let l = m.get(u);
      if (!l) {
        l = linhasVazias(anos);
        m.set(u, l);
      }
      return l;
    };
    // O MOOC de cada câmpus, separado, para a opção de manter o número de alunos MOOC fixo.
    const moocPorCampus = new Map<number, { anos: MoocDoAno[]; hoje: { alunos: number; medida: number; contados: number } }>();
    todos.forEach((c, i) => {
      if (!passa[i]) return;
      const l = linhasDe(c.unidadeId);
      let m: { anos: MoocDoAno[]; hoje: { alunos: number; medida: number; contados: number } } | undefined;
      if (mooc.manter && c.repasse === "EAD_MOOC") {
        m = moocPorCampus.get(c.unidadeId);
        if (!m) {
          m = { anos: Array.from({ length: anos }, () => ({ matric: 0, repos: 0, reposTudo: 0, contados: 0 })), hoje: { alunos: 0, medida: 0, contados: 0 } };
          moocPorCampus.set(c.unidadeId, m);
        }
      }
      matriculadosPorCiclo[i]!.forEach((p, k) => {
        const v = valorNaMedida(qual, p, c.fatorMateq);
        l[k]!.matric += v;
        l[k]!.alunos += p.alunosContados;
        if (m) {
          m.anos[k]!.matric += v;
          m.anos[k]!.contados += p.alunosContados;
          if (k === 0) {
            m.hoje.alunos += p.alunos;
            m.hoje.medida += v;
            m.hoje.contados += p.alunosContados;
          }
        }
      });
      const parar = paradasEfetivas[chaveDoCurso(c.unidadeId, c.curso, c.tipoOferta)];
      for (const t of turmasPorCiclo[i]!) {
        const conta = reporExistentes && (parar === undefined || t.anoEntrada <= parar - 1);
        t.pontos.forEach((p, k) => {
          const v = valorNaMedida(qual, p, c.fatorMateq);
          l[k]!.reposTudo += v;
          if (m) m.anos[k]!.reposTudo += v;
          if (conta) {
            l[k]!.repos += v;
            l[k]!.alunos += p.alunosContados;
            if (m) {
              m.anos[k]!.repos += v;
              m.anos[k]!.contados += p.alunosContados;
            }
          }
        });
      }
    });
    for (const [unidadeId, m] of moocPorCampus) {
      const alvo = mooc.alunos[String(unidadeId)] ?? m.hoje.alunos;
      const l = linhasDe(unidadeId);
      ajusteParaManterMooc(m.anos, m.hoje, alvo).forEach((a, k) => {
        l[k]!.repos += a.repos;
        l[k]!.reposTudo += a.reposTudo;
        l[k]!.alunos += a.contados;
        l[k]!.ajusteMooc += a.repos;
      });
    }
    novosEspec.forEach((e, j) => {
      if (!e.spec || !passaNoFiltro(e.filtravel!, filtrosDaSoma)) return;
      const l = linhasDe(e.ui.unidadeId);
      for (const t of turmasDosNovos[j]!) {
        t.pontos.forEach((p, k) => {
          // O curso reformulado é a continuação de um curso de hoje: entra na Reposição, não em Cursos novos.
          if (e.ui.reformulado) l[k]!.repos += valorNaMedida(qual, p, e.fatorMateq);
          else l[k]!.novos += valorNaMedida(qual, p, e.fatorMateq);
          l[k]!.alunos += p.alunosContados;
        });
      }
    });
    return m;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const porCampusEmReais = useMemo(() => somarPorCampus("reais"), [todos, matriculadosPorCiclo, turmasPorCiclo, novosEspec, turmasDosNovos, paradasEfetivas, reporExistentes, anos, turmaPassa, filtros, mooc]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // A distribuição entre os câmpus usa sempre todas as turmas, em reais: o filtro da tabela não muda o que cada câmpus recebe.
  const todasPassam = useMemo(() => todos.map(() => true), [todos]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const porCampusCompleto = useMemo(() => somarPorCampus("reais", todasPassam, FILTROS_TODOS), [todos, todasPassam, matriculadosPorCiclo, turmasPorCiclo, novosEspec, turmasDosNovos, paradasEfetivas, reporExistentes, anos, mooc]);
  const anosDaDistribuicao = useMemo(() => Array.from({ length: anos }, (_, k) => anoCiclo + k), [anos, anoCiclo]);
  const matrizParaDistribuicao = useMemo(() => {
    const r: Record<string, number[]> = {};
    for (const [id, l] of porCampusCompleto) r[String(id)] = l.map((x) => x.matric + x.repos + x.novos);
    return r;
  }, [porCampusCompleto]);
  const campiDaDistribuicao = useMemo(() => {
    if (!distribuicaoInterna) return [];
    return distribuicaoInterna.campi
      .map((c) => ({ id: c.id, nome: c.nome, anterior: distribuicaoInterna.anterior[String(c.id)] ?? 0 }))
      .filter((c) => c.anterior > 0 || (matrizParaDistribuicao[String(c.id)] ?? []).some((v) => v > 0));
  }, [distribuicaoInterna, matrizParaDistribuicao]);
  const porCampus = useMemo(() => (medida === "reais" ? porCampusEmReais : somarPorCampus(medida)), [medida, porCampusEmReais]);

  const somarRecorte = (mapa: Map<number, LinhaAno[]>) => {
    if (campusId !== null) return mapa.get(campusId) ?? linhasVazias(anos);
    const soma = linhasVazias(anos);
    for (const l of mapa.values()) {
      l.forEach((x, k) => {
        soma[k]!.matric += x.matric;
        soma[k]!.repos += x.repos;
        soma[k]!.reposTudo += x.reposTudo;
        soma[k]!.novos += x.novos;
        soma[k]!.alunos += x.alunos;
        soma[k]!.ajusteMooc += x.ajusteMooc;
      });
    }
    return soma;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const linhasEmReais = useMemo(() => somarRecorte(porCampusEmReais), [campusId, porCampusEmReais, anos]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const linhas = useMemo(() => somarRecorte(porCampus), [campusId, porCampus, anos]);
  const formatar = (v: number) => (medida === "reais" ? reais.format(v) : inteiro.format(Math.round(v)));
  const formatarComSinal = (v: number) => (medida === "reais" ? comSinal(v) : `${v > 0 ? "+" : "-"}${inteiro.format(Math.abs(Math.round(v)))}`);
  const nomeDaMedida = MEDIDAS.find((m) => m.valor === medida)!.noTexto;

  const nomeDoRecorte = campusId === null ? instituicao : (campi.find((c) => c.id === campusId)?.nome ?? "");
  const ciclosSemFiltro = useMemo(() => todos.filter((c) => campusId === null || c.unidadeId === campusId), [todos, campusId]);
  const ciclosDoRecorte = useMemo(() => todos.filter((c, i) => turmaPassa[i] && (campusId === null || c.unidadeId === campusId)), [todos, turmaPassa, campusId]);

  // Os alunos MOOC de hoje em cada câmpus (só as turmas que passam no filtro): o número de partida da opção de manter o MOOC fixo.
  const moocHojePorCampus = useMemo(() => {
    const m = new Map<number, number>();
    todos.forEach((c, i) => {
      if (!turmaPassa[i] || c.repasse !== "EAD_MOOC") return;
      m.set(c.unidadeId, (m.get(c.unidadeId) ?? 0) + (matriculadosPorCiclo[i]![0]?.alunos ?? 0));
    });
    return m;
  }, [todos, turmaPassa, matriculadosPorCiclo]);
  const moocHojeNoRecorte = campusId === null ? [...moocHojePorCampus.values()].reduce((s, v) => s + v, 0) : (moocHojePorCampus.get(campusId) ?? 0);
  const alvoMoocDoCampus = (id: number) => mooc.alunos[String(id)] ?? moocHojePorCampus.get(id) ?? 0;
  const alvoMoocNoRecorte = campusId === null ? [...moocHojePorCampus.keys()].reduce((s, id) => s + alvoMoocDoCampus(id), 0) : alvoMoocDoCampus(campusId);
  function definirAlvoMooc(valor: number | null) {
    setMooc((atual) => {
      if (campusId !== null) {
        const alunos = { ...atual.alunos };
        if (valor === null) delete alunos[String(campusId)];
        else alunos[String(campusId)] = Math.max(0, valor);
        return { ...atual, alunos };
      }
      // Para a instituição inteira, o número é repartido entre os câmpus na proporção dos alunos MOOC de hoje.
      return { ...atual, alunos: valor === null ? {} : repartirMooc(valor, moocHojePorCampus) };
    });
  }

  // O + de um ano da tabela do cenário: de que curso vem cada parcela daquele ano, na medida escolhida.
  const detalheDoAno = useMemo(() => {
    if (anoAberto === null || anoAberto >= anos) return null;
    const k = anoAberto;
    type Linha = { chave: string; unidadeId: number; curso: string; oferta: string; repasse: Repasse; matric: number; repos: number; novos: number; contados: number; reformulado: boolean };
    const m = new Map<string, Linha>();
    const linhaDe = (unidadeId: number, curso: string, oferta: string, repasse: Repasse, novo: boolean) => {
      const chave = `${novo ? "novo|" : ""}${chaveDoCurso(unidadeId, curso, oferta)}|${repasse}`;
      let l = m.get(chave);
      if (!l) {
        l = { chave, unidadeId, curso, oferta, repasse, matric: 0, repos: 0, novos: 0, contados: 0, reformulado: false };
        m.set(chave, l);
      }
      return l;
    };
    todos.forEach((c, i) => {
      if (!turmaPassa[i] || (campusId !== null && c.unidadeId !== campusId)) return;
      const p = matriculadosPorCiclo[i]![k]!;
      const parar = paradasEfetivas[chaveDoCurso(c.unidadeId, c.curso, c.tipoOferta)];
      const matric = valorNaMedida(medida, p, c.fatorMateq);
      let contados = p.alunosContados;
      let repos = 0;
      for (const t of turmasPorCiclo[i]!) {
        if (!(reporExistentes && (parar === undefined || t.anoEntrada <= parar - 1))) continue;
        const q = t.pontos[k]!;
        repos += valorNaMedida(medida, q, c.fatorMateq);
        contados += q.alunosContados;
      }
      if (Math.abs(matric) < 1e-9 && Math.abs(repos) < 1e-9) return;
      const l = linhaDe(c.unidadeId, c.curso, c.tipoOferta, c.repasse, false);
      l.matric += matric;
      l.repos += repos;
      l.contados += contados;
    });
    novosEspec.forEach((e, j) => {
      if (!e.spec || !e.item || !passaNoFiltro(e.filtravel!, filtros) || (campusId !== null && e.ui.unidadeId !== campusId)) return;
      let novos = 0;
      let contados = 0;
      for (const t of turmasDosNovos[j]!) {
        novos += valorNaMedida(medida, t.pontos[k]!, e.fatorMateq);
        contados += t.pontos[k]!.alunosContados;
      }
      if (Math.abs(novos) < 1e-9) return;
      const l = linhaDe(e.ui.unidadeId, e.item.curso === "*" ? "Qualquer FIC fora do catálogo" : e.item.curso, e.item.tipoOferta, e.ui.repasse, true);
      if (e.ui.reformulado) {
        l.repos += novos;
        l.reformulado = true;
      } else l.novos += novos;
      l.contados += contados;
    });
    const linhasDoAno = [...m.values()].sort((a, b) => b.matric + b.repos + b.novos - (a.matric + a.repos + a.novos));
    const porModalidade = new Map<Repasse, number>();
    for (const l of linhasDoAno) porModalidade.set(l.repasse, (porModalidade.get(l.repasse) ?? 0) + l.matric + l.repos + l.novos);
    return { k, linhas: linhasDoAno, porModalidade };
  }, [anoAberto, anos, todos, turmaPassa, campusId, matriculadosPorCiclo, paradasEfetivas, turmasPorCiclo, reporExistentes, medida, novosEspec, turmasDosNovos, filtros]);

  // Por curso e câmpus: o que cada curso ainda rende só com os alunos de hoje, e a decisão de parar de ofertar.
  const cursos = useMemo(() => {
    const m = new Map<string, { chave: string; unidadeId: number; curso: string; oferta: string; ciclos: number; alunos: number; anoTermino: number; valores: number[]; turmas: { id: number; rotulo: string; alunos: number }[] }>();
    const serialPorId = new Map(ciclos.map((s) => [s.id, s]));
    for (const c of ciclosDoRecorte) {
      if (c.alunos <= 0) continue;
      const chave = chaveDoCurso(c.unidadeId, c.curso, c.tipoOferta);
      const i = todos.indexOf(c);
      const sit = situacaoDoCiclo(c, anoBase0);
      const atual = m.get(chave) ?? { chave, unidadeId: c.unidadeId, curso: c.curso, oferta: c.tipoOferta, ciclos: 0, alunos: 0, anoTermino: 0, valores: Array(anos).fill(0) as number[], turmas: [] };
      atual.ciclos += 1;
      const serial = serialPorId.get(c.id);
      atual.turmas.push({ id: c.id, rotulo: serial ? rotuloDoCiclo(serial) : "", alunos: c.alunos });
      atual.alunos += c.alunos;
      if (sit.regular) atual.anoTermino = Math.max(atual.anoTermino, sit.anoTermino);
      matriculadosPorCiclo[i]!.forEach((p, k) => {
        atual.valores[k]! += valorNaMedida(medida, p, c.fatorMateq);
      });
      m.set(chave, atual);
    }
    return [...m.values()].sort((a, b) => b.valores[0]! - a.valores[0]!);
  }, [ciclos, ciclosDoRecorte, todos, anoBase0, anos, matriculadosPorCiclo, medida]);
  const [cursosAbertos, setCursosAbertos] = useState<Set<string>>(new Set());
  function alternarCurso(chave: string) {
    setCursosAbertos((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      return novo;
    });
  }

  const cursosFiltrados = useMemo(() => {
    const f = filtroCurso.trim().toLowerCase();
    return f ? cursos.filter((c) => c.curso.toLowerCase().includes(f)) : cursos;
  }, [cursos, filtroCurso]);
  const cursosVisiveis = verTodosOsCursos ? cursosFiltrados : cursosFiltrados.slice(0, 25);
  const nomeDoCampus = (id: number) => (campi.find((c) => c.id === id)?.nome ?? "").replace(/^CAMPUS( AVANÇADO)? /, "");

  // Durações observadas nos ciclos de hoje, para sugerir a duração de um curso novo.
  const duracaoObservada = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const c of todos) {
      const anosDoCiclo = (c.termino.getTime() - c.inicio.getTime()) / (365.25 * 86_400_000);
      if (anosDoCiclo <= 0) continue;
      const k = `${c.curso}|${c.tipoOferta}`;
      m.set(k, [...(m.get(k) ?? []), anosDoCiclo]);
    }
    return new Map([...m].map(([k, v]) => [k, Math.round(mediana(v) * 2) / 2]));
  }, [todos]);

  // Por que o valor muda de um ano para o outro: cada turma do recorte, ano a ano, na medida da tabela, e a causa de cada variação.
  const variacoes = useMemo(() => {
    const lista: TurmaNoTempo[] = [];
    const nome = (curso: string, oferta: string, unidadeId: number) =>
      `${curso}${oferta && oferta !== "NÃO SE APLICA" && oferta !== "*" ? ` (${oferta.toLowerCase()})` : ""}${campusId === null ? ` · ${nomeDoCampus(unidadeId)}` : ""}`;
    todos.forEach((c, i) => {
      if (!turmaPassa[i] || (campusId !== null && c.unidadeId !== campusId)) return;
      const n = nome(c.curso, c.tipoOferta, c.unidadeId);
      lista.push({ curso: n, origem: "hoje", anoTermino: c.termino.getUTCFullYear(), valores: matriculadosPorCiclo[i]!.map((p) => valorNaMedida(medida, p, c.fatorMateq)) });
      const parar = paradasEfetivas[chaveDoCurso(c.unidadeId, c.curso, c.tipoOferta)];
      for (const t of turmasPorCiclo[i]!) {
        if (!(reporExistentes && (parar === undefined || t.anoEntrada <= parar - 1))) continue;
        lista.push({ curso: n, origem: "reposicao", anoTermino: t.anoTermino, valores: t.pontos.map((p) => valorNaMedida(medida, p, c.fatorMateq)) });
      }
    });
    novosEspec.forEach((e, j) => {
      if (!e.spec || !e.item || !passaNoFiltro(e.filtravel!, filtros) || (campusId !== null && e.ui.unidadeId !== campusId)) return;
      const n = `${nome(e.item.curso === "*" ? "Qualquer FIC fora do catálogo" : e.item.curso, e.item.tipoOferta, e.ui.unidadeId)}${e.ui.reformulado ? ", currículo novo" : ", curso novo"}`;
      for (const t of turmasDosNovos[j]!)
        lista.push({ curso: n, origem: e.ui.reformulado ? "reformulado" : "novo", anoTermino: t.anoTermino, valores: t.pontos.map((p) => valorNaMedida(medida, p, e.fatorMateq)) });
    });
    return decomporVariacoes(lista, anos, anoBase0, linhas.map((l) => l.ajusteMooc));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todos, turmaPassa, campusId, matriculadosPorCiclo, medida, paradasEfetivas, turmasPorCiclo, reporExistentes, novosEspec, filtros, turmasDosNovos, anos, anoBase0, linhas]);

  function adicionarCurso() {
    setFormulario({
      id: null,
      dados: {
        id: Date.now(),
        unidadeId: campusId ?? campi[0]?.id ?? 0,
        catalogoIdx: -1,
        busca: "",
        anoInicio: anoBase0 + 2,
        mes: 3,
        entradas: 1,
        anoFim: anoBase0 + 2,
        continua: true,
        ingressantes: VAGAS_POR_ANO_PADRAO,
        duracao: 3,
        repasse: "PRESENCIAL",
      },
    });
  }
  function alterarCurso(ui: NovoCursoUI) {
    setFormulario({ id: ui.id, dados: { ...ui, busca: "" } });
  }
  function mudarRascunho(mudanca: Partial<NovoCursoUI>) {
    setFormulario((f) => (f ? { ...f, dados: { ...f.dados, ...mudanca } } : f));
  }
  function escolherDoCatalogo(idx: number) {
    const item = catalogo[idx];
    if (!item) return;
    const sugerida = duracaoObservada.get(`${item.curso}|${item.tipoOferta}`) || duracaoPadrao(item.tipoCurso, item.tipoOferta);
    mudarRascunho({ catalogoIdx: idx, duracao: sugerida, busca: "" });
  }
  function salvarFormulario() {
    if (!formulario || formulario.dados.catalogoIdx < 0) return;
    const dados = { ...formulario.dados, busca: "" };
    setNovos((atual) => (formulario.id === null ? [...atual, dados] : atual.map((n) => (n.id === formulario.id ? dados : n))));
    setFormulario(null);
  }
  function excluirCurso(ui: NovoCursoUI, nome: string) {
    if (!window.confirm(`Excluir "${nome}" do cenário?`)) return;
    setNovos((a) => a.filter((n) => n.id !== ui.id));
    if (formulario?.id === ui.id) setFormulario(null);
  }
  function definirParada(chave: string, ano: number | null) {
    setEncerramentos((atual) => {
      const novo = { ...atual };
      if (ano === null || Number.isNaN(ano)) delete novo[chave];
      else novo[chave] = ano;
      return novo;
    });
  }
  function limparCenario() {
    setEncerramentos({});
    setNovos([]);
    setFormulario(null);
    setReporExistentes(true);
  }

  const fimDoHorizonte = anoBase0 + anos - 1;
  const comAlunos = ciclosDoRecorte.filter((c) => c.alunos > 0);
  const regulares = comAlunos.filter((c) => situacaoDoCiclo(c, anoBase0).regular);
  const atrasados = comAlunos.filter((c) => !situacaoDoCiclo(c, anoBase0).regular);
  // Um curso que continua sendo ofertado não tem "último término": para sugerir o horizonte, conta só a primeira turma dele.
  const novosDoRecorte = novosEspec
    .filter((e) => e.spec && passaNoFiltro(e.filtravel!, filtros) && (campusId === null || e.ui.unidadeId === campusId))
    .map((e) => (e.ui.continua === true ? { ...e.spec!, ultimoAnoEntrada: e.spec!.primeiroAnoEntrada } : e.spec!));
  const ultimoNecessario = ultimoAnoDeTermino(ciclosDoRecorte, novosDoRecorte, anoBase0);

  const total = (f: (l: LinhaAno) => number) => linhasEmReais.reduce((s, l) => s + f(l), 0);
  const totalMatric = total((l) => l.matric);
  const totalCenario = total((l) => l.matric + l.repos + l.novos);
  const totalManter = total((l) => l.matric + l.reposTudo);
  const diferenca = totalCenario - totalManter;
  const maxAno = Math.max(...linhas.map((l) => l.matric + l.repos + l.novos), 1);
  const primeiro = linhas[0] ? linhas[0].matric + linhas[0].repos + linhas[0].novos : 0;
  const alunosHoje = (l: { alunos: number }[]) => l.reduce((s, c) => s + c.alunos, 0);
  const alunosNoFiltro = alunosHoje(ciclosDoRecorte);
  const alunosNoRecorte = alunosHoje(ciclosSemFiltro);
  const comFiltro = filtroAtivo(filtros);
  const resumoDoFiltro = comFiltro
    ? `Filtro ligado: a conta usa ${inteiro.format(ciclosDoRecorte.length)} das ${inteiro.format(ciclosSemFiltro.length)} turmas de ${nomeDoRecorte}, com ${inteiro.format(Math.round(alunosNoFiltro))} dos ${inteiro.format(Math.round(alunosNoRecorte))} alunos de hoje (${alunosNoRecorte > 0 ? decimal.format((alunosNoFiltro / alunosNoRecorte) * 100) : "0,0"}%). Os números abaixo são só dessa parte.`
    : `Sem filtro: a conta usa todas as ${inteiro.format(ciclosSemFiltro.length)} turmas de ${nomeDoRecorte}, com ${inteiro.format(Math.round(alunosNoRecorte))} alunos de hoje.`;
  const turmasSemFatorDaPnp = ciclosDoRecorte.filter((c) => !c.fatorDaPnp).length;
  const quantosParados = Object.keys(encerramentos).filter((k) => campusId === null || k.startsWith(`${campusId}|`)).length;

  const textoParaOChat = [
    `Cenário de ${nomeDoRecorte}, matrizes de ${anoCiclo} a ${anoCiclo + anos - 1}. ${resumoDoFiltro} Tabela em ${nomeDaMedida}.`,
    `Evasão anual: ${decimal.format(evPresencial)}% presencial e ${decimal.format(evEad)}% a distância. Repor as turmas dos cursos existentes: ${reporExistentes ? "sim" : "não"}. Cursos que deixam de ser ofertados: ${quantosParados}. Cursos novos: ${novosDoRecorte.length}.`,
    ...linhasEmReais.map(
      (l, k) =>
        `${anoCiclo + k}: matriculados hoje ${reais.format(l.matric)}, reposição ${reais.format(l.repos)}, cursos novos ${reais.format(l.novos)}, total ${reais.format(l.matric + l.repos + l.novos)}.`,
    ),
    ...(medida === "reais" ? [] : linhas.map((l, k) => `${anoCiclo + k}, em ${nomeDaMedida}: ${formatar(l.matric + l.repos + l.novos)}.`)),
    `Total do cenário: ${reais.format(totalCenario)}; manter tudo como está: ${reais.format(totalManter)}; diferença ${comSinal(diferenca)}. Para os matriculados terminarem: ${reais.format(totalMatric)}.`,
  ].join("\n");

  return (
    <div className="flex flex-col gap-6">
      <ContextoDaTela texto={textoParaOChat} />

      <section className="flex flex-wrap items-start gap-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex min-w-64 flex-1 flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Instituição</span>
          {seletorInstituicao}
        </div>
        <label className="flex min-w-56 flex-1 flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Câmpus</span>
          <select value={campusId ?? ""} onChange={(e) => setCampusId(e.target.value === "" ? null : Number(e.target.value))} className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100">
            <option value="">{instituicao} inteiro</option>
            {campi.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome.replace(/^CAMPUS( AVANÇADO)? /, "")}
              </option>
            ))}
          </select>
        </label>
      </section>

      <FiltrosDoCenario filtros={filtros} onChange={setFiltros} resumo={resumoDoFiltro} />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Cartao
          titulo="Para os matriculados terminarem"
          valor={reais.format(totalMatric)}
          nota={`Soma de ${anoCiclo} a ${anoCiclo + anos - 1} só para os alunos que já estão em ${nomeDoRecorte}, sem nenhuma turma nova.`}
        />
        <Cartao
          titulo="Total do cenário"
          valor={reais.format(totalCenario)}
          nota={`Matriculados, reposição das turmas que continuam e cursos novos, de ${anoCiclo} a ${anoCiclo + anos - 1}.`}
        />
        <Cartao
          titulo="Sobre manter tudo como está"
          valor={comSinal(diferenca)}
          nota={`Manter tudo daria ${reais.format(totalManter)}. A diferença vem dos cursos que param e dos cursos novos.`}
        />
        <Cartao
          titulo="Último ciclo termina em"
          valor={String(ultimoNecessario)}
          nota={
            ultimoNecessario > fimDoHorizonte
              ? `Depois do horizonte mostrado (${fimDoHorizonte}, ano-base). Aumente os anos à frente. ${atrasados.length} ciclo(s) atrasado(s).`
              : `Dentro do horizonte. ${regulares.length} ciclos regulares e ${atrasados.length} atrasado(s) (${inteiro.format(Math.round(atrasados.reduce((s, c) => s + c.alunos, 0)))} alunos).`
          }
        />
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Cenário ano a ano, {nomeDoRecorte}, em {nomeDaMedida}</h2>
          <div role="group" aria-label="Ver a tabela em" className="flex flex-wrap items-center gap-1 text-sm">
            <span className="mr-1 text-xs font-medium uppercase tracking-wide text-neutral-500">Ver em</span>
            {MEDIDAS.map((m) => (
              <button
                key={m.valor}
                type="button"
                aria-pressed={medida === m.valor}
                onClick={() => setMedida(m.valor)}
                className={`rounded-md px-3 py-1.5 font-medium ${medida === m.valor ? "bg-if-green text-white" : "border border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"}`}
              >
                {m.rotulo}
              </button>
            ))}
          </div>
        </div>
        <div className="tabela-rolavel">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-3 py-2">Ano da matriz</th>
                <th className="px-3 py-2">Dado da PNP de</th>
                {medida === "reais" && <th className="px-3 py-2 text-right">Alunos que a MDO conta</th>}
                <th className="px-3 py-2 text-right">Já matriculados</th>
                <th className="px-3 py-2 text-right">Reposição</th>
                <th className="px-3 py-2 text-right">Cursos novos</th>
                <th className="px-3 py-2 text-right">Total do cenário</th>
                <th className="px-3 py-2 text-right">Sobre manter tudo</th>
                <th className="w-48 px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {linhas.map((l, k) => {
                const totalAno = l.matric + l.repos + l.novos;
                const dif = totalAno - (l.matric + l.reposTudo);
                const aberto = anoAberto === k;
                return (
                  <Fragment key={k}>
                  <tr className={k === 0 ? "bg-neutral-50 dark:bg-neutral-900" : ""}>
                    <td className="px-3 py-2 font-medium">
                      <button
                        type="button"
                        onClick={() => {
                          setAnoAberto(aberto ? null : k);
                          setDetalheCompleto(false);
                        }}
                        aria-expanded={aberto}
                        title="Abre, abaixo desta linha, de que curso vêm os alunos deste ano"
                        className="flex items-center gap-2 text-left hover:text-if-green"
                      >
                        <SinalMaisMenos aberto={aberto} />
                        <span>
                          {anoCiclo + k}
                          {k === 0 && <span className="ml-2 text-xs font-normal text-neutral-500">hoje</span>}
                        </span>
                      </button>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{anoBase0 + k}</td>
                    {medida === "reais" && <td className="px-3 py-2 text-right tabular-nums">{inteiro.format(Math.round(l.alunos))}</td>}
                    <td className="px-3 py-2 text-right tabular-nums">{formatar(l.matric)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-neutral-600 dark:text-neutral-400">{formatar(l.repos)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-neutral-600 dark:text-neutral-400">{formatar(l.novos)}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{formatar(totalAno)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${Math.abs(dif) < 1 ? "text-neutral-400" : dif > 0 ? "text-if-green" : "text-if-red dark:text-red-400"}`}>
                      {Math.abs(dif) < 1 ? "-" : formatarComSinal(dif)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex h-3 w-full overflow-hidden rounded bg-neutral-100 dark:bg-neutral-800" title="Verde: já matriculados. Azul: reposição. Âmbar: cursos novos.">
                        <div className="bg-if-green" style={{ width: `${(l.matric / maxAno) * 100}%` }} />
                        <div className="bg-sky-500" style={{ width: `${(l.repos / maxAno) * 100}%` }} />
                        <div className="bg-amber-500" style={{ width: `${(l.novos / maxAno) * 100}%` }} />
                      </div>
                    </td>
                  </tr>
                  {aberto && detalheDoAno && detalheDoAno.k === k && (
                    <tr data-detalhe="1">
                      <td colSpan={99} className="bg-neutral-50 px-3 py-3 dark:bg-neutral-900">
                        <DetalheDoAno
                          anoMatriz={anoCiclo + k}
                          anoPnp={anoBase0 + k}
                          detalhe={detalheDoAno}
                          ajusteMooc={l.ajusteMooc}
                          alvoMooc={mooc.manter ? alvoMoocNoRecorte : null}
                          comCampus={campusId === null}
                          nomeDoCampus={nomeDoCampus}
                          medida={medida}
                          nomeDaMedida={nomeDaMedida}
                          formatar={formatar}
                          completo={detalheCompleto}
                          onCompleto={setDetalheCompleto}
                        />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {medida === "alunos" && (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            <strong>Matrícula projetada:</strong> o número de alunos matriculados em cada ano. Cada matrícula vale 1, como a PNP conta (matrícula ativa em pelo menos um dia do ano). O primeiro ano é o número publicado; os seguintes são estimativa, com a evasão e a retenção da projeção. Quem faz dois cursos conta duas vezes.
          </p>
        )}
        {medida === "contados" && (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            <strong>Alunos que a MDO conta:</strong> as matrículas vezes o ICQA. O aluno retido, de turma já encerrada, vale meio, e quem passou do prazo de jubilamento vale zero. Por exemplo, 10 alunos retidos contam como 5.
          </p>
        )}
        {medida === "mateq" && (
          <div className="flex flex-col gap-1 text-sm text-neutral-600 dark:text-neutral-400">
            <p>
              <strong>Matrícula equivalente (Mateq):</strong> pela Portaria Setec 146/2021, art. 2º, é a matrícula vezes o fator de carga horária (fech) e o fator de esforço do curso (fec). Fora do FIC, fech é 1: um aluno de um técnico com fec 1,02 vale 1,02. No FIC, fech é a carga horária ÷ 800: um aluno de um curso de 40 h com fec 1,1 vale 0,055. É sobre esta medida que o art. 4º calcula os percentuais legais.
            </p>
            <p>
              Para o FIC usamos a carga horária do curso, como a PNP publica, e não a carga mínima citada na portaria. Assim o número confere com a PNP no ano de hoje. Esta medida não é a Matrícula Total, que a MDO usa para repartir o orçamento.
              {turmasSemFatorDaPnp > 0 ? ` ${inteiro.format(turmasSemFatorDaPnp)} turma(s) não foram achadas na PNP e usam o fec padrão do tipo de curso.` : ""}
            </p>
          </div>
        )}
        <p className="text-xs text-neutral-500">
          O + de um ano abre, logo abaixo dele, de que curso vem cada parcela daquele ano (já matriculados, reposição e cursos novos), com a soma por modalidade.{" "}
          {mooc.manter ? <>O MOOC está fixo em {inteiro.format(Math.round(alvoMoocNoRecorte))} alunos por ano a partir de {anoCiclo + 1}; a diferença para a projeção está na Reposição. </> : null}
          {medida === "reais" ? <>Valores em reais de hoje, com o valor da matrícula de cada turma como está na matriz de {anoCiclo}. </> : null}
          Os anos que você digita nos cursos novos e nas paradas são anos reais do curso (quando a turma entra); a matriz de cada ano usa os dados de dois anos antes, por isso a
          primeira coluna é o ano da matriz (o ano real mais dois).
        </p>
      </section>

      <PorQueMuda
        variacoes={variacoes}
        manterTudo={linhas.map((l) => l.matric + l.reposTudo)}
        anoCiclo={anoCiclo}
        formatar={formatar}
        formatarComSinal={formatarComSinal}
        nomeDaMedida={nomeDaMedida}
        nomeDoRecorte={nomeDoRecorte}
      />

      {campusId === null && (
        <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Total do cenário por câmpus, em {nomeDaMedida}</h2>
          <div className="tabela-rolavel">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-3 py-2">Câmpus</th>
                  {linhas.map((_, k) => (
                    <th key={k} className="px-3 py-2 text-right">
                      {anoCiclo + k}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right">Sobre manter tudo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {campi.map((c) => {
                  const l = porCampus.get(c.id);
                  if (!l) return null;
                  const t = l.reduce((s, x) => s + x.matric + x.repos + x.novos, 0);
                  const m = l.reduce((s, x) => s + x.matric + x.reposTudo, 0);
                  if (t <= 0 && m <= 0) return null;
                  return (
                    <tr key={c.id} className="cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900" onClick={() => setCampusId(c.id)}>
                      <td className="px-3 py-2 font-medium">{c.nome.replace(/^CAMPUS( AVANÇADO)? /, "")}</td>
                      {l.map((x, k) => (
                        <td key={k} className="px-3 py-2 text-right tabular-nums">
                          {formatar(x.matric + x.repos + x.novos)}
                        </td>
                      ))}
                      <td className={`px-3 py-2 text-right tabular-nums ${Math.abs(t - m) < 1 ? "text-neutral-400" : t > m ? "text-if-green" : "text-if-red dark:text-red-400"}`}>
                        {Math.abs(t - m) < 1 ? "-" : formatarComSinal(t - m)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {distribuicaoInterna && campiDaDistribuicao.length > 0 && (
        <DistribuicaoProjetada
          anos={anosDaDistribuicao}
          campi={campiDaDistribuicao}
          matriz={matrizParaDistribuicao}
          oficial={distribuicaoInterna.oficial}
          origemDaMatriz={`A Matriz 1 de cada ano é a matriz projetada nesta tela para cada câmpus, com todas as turmas (o filtro da tabela acima não vale aqui) e com o cenário montado: cursos novos, paradas, evasão e MOOC. O ponto de partida é o que cada câmpus recebeu em ${anoCiclo - 1}.`}
          config={distribuicao}
          onConfig={setDistribuicao}
        />
      )}

      <details open={mooc.manter} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <summary className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">O horizonte e o que a projeção supõe{mooc.manter ? " (MOOC fixo)" : ""}</summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1 text-sm">
          <label htmlFor="anos" className="font-medium text-neutral-700 dark:text-neutral-300">
            Anos à frente
          </label>
          <input
            id="anos"
            type="number"
            min={1}
            max={MAX_ANOS}
            value={anos}
            onChange={(e) => setAnos(Math.min(MAX_ANOS, Math.max(1, Math.round(Number(e.target.value) || 1))))}
            className={campo}
          />
          <span className="text-xs text-neutral-500">
            Matrizes de {anoCiclo} a {anoCiclo + anos - 1}. De 1 a {MAX_ANOS}.{" "}
            <button
              type="button"
              className="font-medium text-if-green underline"
              onClick={() => setAnos(Math.min(MAX_ANOS, Math.max(1, ultimoNecessario - anoBase0 + 1)))}
              title="Ajusta o horizonte para o ano do último término entre os cursos de hoje e os cursos novos do cenário."
            >
              até o último ciclo terminar ({ultimoNecessario})
            </button>
          </span>
        </div>
        <Percentual
          rotulo="Evasão anual, presencial (%)"
          valor={evPresencial}
          onChange={setEvPresencial}
          padrao={Math.round(taxasPadrao.presencial * 1000) / 10}
          ajuda={taxasPadrao.semDado ? "Sem dado da PNP: valor de partida" : "Média do instituto na PNP"}
        />
        <Percentual
          rotulo="Evasão anual, a distância (%)"
          valor={evEad}
          onChange={setEvEad}
          padrao={Math.round(taxasPadrao.ead * 1000) / 10}
          ajuda={taxasPadrao.semDado ? "Sem dado da PNP: valor de partida" : "Média do instituto na PNP"}
        />
        <div className="flex flex-col gap-1 text-xs text-neutral-600 dark:text-neutral-400">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">De onde vêm as taxas</span>
          <span>{taxasPadrao.origem}</span>
          {taxasPadrao.porAno.length > 0 && (
            <span>{taxasPadrao.porAno.map((a) => `${a.anoBase}: ${a.presencial !== null ? pct(a.presencial) : "-"} presencial, ${a.ead !== null ? pct(a.ead) : "-"} a distância`).join("; ")}</span>
          )}
          <span className="mt-1">
            <strong className="font-medium text-neutral-700 dark:text-neutral-300">Retidos depois do término:</strong> de cada 100 alunos no término, ficam{" "}
            {retencao.retencao.map((r) => inteiro.format(Math.round(r * 100))).join(", ")} um, dois e três anos depois.{" "}
            {retencao.observada
              ? `Medido nos ${inteiro.format(Math.round(retencao.alunosNoTermino))} alunos dos ciclos que terminam em ${anoBase0}, contra os ciclos terminados nos três anos anteriores.`
              : "Sem alunos suficientes para medir: valor de partida."}
          </span>
        </div>
        </div>
        <div className="mt-4 flex flex-col gap-2 border-t border-neutral-200 pt-4 text-sm dark:border-neutral-800">
          <label className="flex items-center gap-2 font-medium text-neutral-700 dark:text-neutral-300">
            <input type="checkbox" checked={mooc.manter} onChange={(e) => setMooc((a) => ({ ...a, manter: e.target.checked }))} disabled={moocHojeNoRecorte <= 0 && !mooc.manter} />
            Manter a matrícula MOOC num número fixo de alunos por ano
          </label>
          {moocHojeNoRecorte <= 0 ? (
            <span className="text-xs text-neutral-500">{nomeDoRecorte} não tem alunos MOOC nas turmas de hoje{comFiltro ? " (com o filtro ligado)" : ""}: não há o que manter.</span>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-xs text-neutral-600 dark:text-neutral-400">
                  Alunos MOOC por ano em {nomeDoRecorte}
                  <input
                    type="number"
                    min={0}
                    step={1}
                    disabled={!mooc.manter}
                    value={Math.round(alvoMoocNoRecorte)}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v)) definirAlvoMooc(Math.max(0, Math.round(v)));
                    }}
                    className={`${campo} w-40 tabular-nums`}
                  />
                </label>
                {Math.round(alvoMoocNoRecorte) !== Math.round(moocHojeNoRecorte) && (
                  <button type="button" onClick={() => definirAlvoMooc(null)} className="text-xs font-medium text-if-green underline">
                    voltar aos {inteiro.format(Math.round(moocHojeNoRecorte))} de hoje
                  </button>
                )}
              </div>
              <span className="text-xs text-neutral-600 dark:text-neutral-400">
                Os cursos MOOC duram semanas e abrem turmas o ano todo, então repetir as turmas de hoje, como a projeção faz com os outros cursos, dá uma curva que depende de quando cada turma caiu no ano-base. Com esta opção, todo ano depois de {anoCiclo} passa a ter esse número de alunos MOOC, e cada um vale o mesmo que um aluno MOOC vale hoje no câmpus. Hoje são {inteiro.format(Math.round(moocHojeNoRecorte))} em {nomeDoRecorte}.
                {campusId === null ? " Para o instituto inteiro, o número é repartido entre os câmpus na proporção dos alunos MOOC de hoje; escolha um câmpus para dar um número só a ele." : ""} A diferença para a projeção entra na Reposição, e também em &quot;manter tudo&quot;, porque é uma premissa, não uma mudança do cenário. Cursos MOOC novos, acrescentados abaixo, somam por fora.
              </span>
            </>
          )}
        </div>
      </details>

      <details open={Object.keys(encerramentos).length > 0} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <summary className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Cursos que deixam de ser ofertados ({Object.keys(encerramentos).length})</summary>
        <div className="mt-3 flex flex-col gap-3">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Escolha, para cada curso, o ano a partir do qual não entram turmas novas. As turmas que já estão em andamento terminam o curso normalmente (e entram na conta). Deixe em
          branco o curso que continua sendo ofertado.
        </p>
        <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
          <input type="checkbox" checked={reporExistentes} onChange={(e) => setReporExistentes(e.target.checked)} />
          Repor as turmas dos cursos que continuam (se desmarcar, nenhum curso recebe turma nova)
        </label>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-neutral-600 dark:text-neutral-400">
            Procurar curso
            <input value={filtroCurso} onChange={(e) => setFiltroCurso(e.target.value)} placeholder="nome do curso" className={campo} />
          </label>
          <button type="button" className="rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700" onClick={() => setEncerramentos({})}>
            Remover todas as paradas
          </button>
        </div>
        <div className="tabela-rolavel">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-3 py-2">Curso</th>
                {campusId === null && <th className="px-3 py-2">Câmpus</th>}
                <th className="px-3 py-2 text-right">Turmas</th>
                <th className="px-3 py-2 text-right">Alunos hoje</th>
                <th className="px-3 py-2 text-right">Termina em</th>
                <th className="px-3 py-2 text-right">Sem turmas novas a partir de</th>
                {linhas.slice(0, Math.min(anos, 6)).map((_, k) => (
                  <th key={k} className="px-3 py-2 text-right" title="Só os matriculados de hoje">
                    {anoCiclo + k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {cursosVisiveis.map((c) => (
                <Fragment key={c.chave}>
                <tr className={paradasEfetivas[c.chave] !== undefined ? "bg-amber-50 dark:bg-amber-950/30" : ""}>
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => alternarCurso(c.chave)} aria-expanded={cursosAbertos.has(c.chave)} className="flex items-start gap-2 text-left hover:text-if-green">
                      <SinalMaisMenos aberto={cursosAbertos.has(c.chave)} />
                      <span>
                        {c.curso}
                        {c.oferta && c.oferta !== "NÃO SE APLICA" ? <span className="text-xs text-neutral-500"> ({c.oferta.toLowerCase()})</span> : null}
                      </span>
                    </button>
                  </td>
                  {campusId === null && <td className="px-3 py-2 text-xs text-neutral-600 dark:text-neutral-400">{nomeDoCampus(c.unidadeId)}</td>}
                  <td className="px-3 py-2 text-right tabular-nums">{c.ciclos}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{inteiro.format(Math.round(c.alunos))}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.anoTermino > 0 ? c.anoTermino : <span className="text-xs text-neutral-500">atrasado</span>}</td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      min={anoBase0 + 1}
                      max={anoBase0 + MAX_ANOS}
                      placeholder="continua"
                      value={encerramentos[c.chave] ?? ""}
                      onChange={(e) => definirParada(c.chave, e.target.value === "" ? null : Number(e.target.value))}
                      className="w-28 rounded border border-neutral-300 bg-white px-2 py-1 text-right text-sm tabular-nums dark:border-neutral-700 dark:bg-neutral-900"
                      aria-label={`Parar de ofertar ${c.curso}`}
                    />
                    {substituidoPor.get(c.chave) && (
                      <span className="mt-1 block text-xs text-violet-700 dark:text-violet-300">
                        currículo novo a partir de {substituidoPor.get(c.chave)!.anoInicio}
                      </span>
                    )}
                  </td>
                  {c.valores.slice(0, Math.min(anos, 6)).map((v, k) => (
                    <td key={k} className="px-3 py-2 text-right tabular-nums">
                      {v > 0 ? formatar(v) : <span className="text-neutral-400">-</span>}
                    </td>
                  ))}
                </tr>
                {cursosAbertos.has(c.chave) && (
                  <tr data-detalhe="1">
                    <td colSpan={99} className="bg-neutral-50 px-3 py-2 dark:bg-neutral-900">
                      <ul className="flex flex-col gap-1 text-xs text-neutral-700 dark:text-neutral-300">
                        {c.turmas.map((t) => (
                          <li key={t.id}>
                            {t.rotulo}: {inteiro.format(Math.round(t.alunos))} alunos
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {cursosFiltrados.length > 25 && (
          <button type="button" onClick={() => setVerTodosOsCursos((v) => !v)} className="self-start text-sm font-medium text-if-green underline">
            {verTodosOsCursos ? "Mostrar só os 25 maiores" : `Mostrar os ${cursosFiltrados.length} cursos`}
          </button>
        )}
        <p className="text-xs text-neutral-500">
          O + de um curso abre as turmas somadas nele, com o código e o período. As colunas de anos mostram só quem já está matriculado (até seis anos), em {nomeDaMedida}; o efeito de parar um curso aparece na tabela do cenário, na coluna Reposição e em Sobre manter tudo.
          "Atrasado" quer dizer que todos os ciclos do curso já passaram do término.
        </p>
        </div>
      </details>

      <details open={novos.length > 0} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <summary className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Cursos novos e reformulados ({novos.length})</summary>
        <div className="mt-3 flex flex-col gap-3">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Uma linha por curso: o câmpus, o curso (da tabela de pesos, que dá o peso e a carga horária), a primeira turma, quantos entram e por quanto tempo. A tabela só mostra; para mudar um
          curso use <strong>Alterar</strong>, que abre o formulário logo abaixo da linha, e para tirar do cenário use <strong>Excluir</strong>. Marque <strong>Reformulado</strong> quando for o
          currículo novo de um curso que o câmpus já oferta: ele conta como continuidade (na Reposição), não como curso novo, e o curso antigo escolhido deixa de receber turma a partir da
          primeira turma do novo.
        </p>
        <div className="tabela-rolavel rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2">Câmpus</th>
                <th className="min-w-56 px-3 py-2">Curso</th>
                <th className="px-3 py-2">Modalidade</th>
                <th className="px-3 py-2">Novo ou reformulado</th>
                <th className="px-3 py-2">1ª turma</th>
                <th className="px-3 py-2">Entradas</th>
                <th className="px-3 py-2 text-right">Ingressantes</th>
                <th className="px-3 py-2 text-right">Duração</th>
                <th className="px-3 py-2">Oferta</th>
                <th className="px-3 py-2 text-right">Um aluno rende</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {novosEspec.length === 0 && formulario?.id !== null && (
                <tr>
                  <td colSpan={11} className="px-3 py-4 text-center text-sm text-neutral-500">
                    Nenhum curso novo ou reformulado. Use &quot;Adicionar curso&quot; abaixo.
                  </td>
                </tr>
              )}
              {novosEspec.map(({ ui, item, spec }) => {
                const valorAluno = spec ? spec.peso * (spec.chMatriz / 800) * spec.valorPorMT : 0;
                const nomeDoCurso = item ? (item.curso === "*" ? "Qualquer FIC fora do catálogo" : item.curso) : ui.busca.trim() || "Curso não escolhido";
                const substituido = ui.substitui ? cursos.find((c) => c.chave === ui.substitui) : undefined;
                const aberto = formulario?.id === ui.id;
                const celula = "px-3 py-2 align-top";
                return (
                  <Fragment key={ui.id}>
                    <tr className={aberto ? "bg-if-green/10" : ui.reformulado ? "bg-violet-50/60 dark:bg-violet-950/20" : ""}>
                      <td className={celula}>{nomeDoCampus(ui.unidadeId)}</td>
                      <td className={celula}>
                        <span className={`font-medium ${item ? "" : "text-if-red"}`}>{nomeDoCurso}</span>
                        <span className="block text-xs text-neutral-500">
                          {item
                            ? `${item.tipoCurso.toLowerCase()}${item.tipoOferta !== "*" && item.tipoOferta !== "NÃO SE APLICA" ? `, ${item.tipoOferta.toLowerCase()}` : ""}`
                            : "fora da conta: use Alterar e escolha o curso na tabela de pesos"}
                        </span>
                      </td>
                      <td className={celula}>{MODALIDADE_CURTA[ui.repasse]}</td>
                      <td className={celula}>
                        {ui.reformulado ? "Reformulado" : "Novo"}
                        {substituido && <span className="block text-xs text-neutral-500">no lugar de {substituido.curso}</span>}
                      </td>
                      <td className={`${celula} tabular-nums`}>
                        {MESES[ui.mes - 1]}/{ui.anoInicio}
                      </td>
                      <td className={celula}>{ui.entradas === 2 ? "2 por ano" : "1 por ano"}</td>
                      <td className={`${celula} text-right tabular-nums`}>{inteiro.format(ui.ingressantes)}</td>
                      <td className={`${celula} text-right tabular-nums`}>
                        {decimal.format(ui.duracao)} {ui.duracao === 1 ? "ano" : "anos"}
                      </td>
                      <td className={celula}>{ui.continua === true ? "todo ano" : ui.anoFim === ui.anoInicio ? "uma turma só" : `até ${ui.anoFim}`}</td>
                      <td
                        className={`${celula} text-right tabular-nums`}
                        title={item && spec ? `Peso ${decimal.format(item.pesoEfetivo)}, mínima do MEC ${inteiro.format(item.chMinimaMec)} h, carga horária que vale ${inteiro.format(spec.chMatriz)} h, no curso inteiro.` : undefined}
                      >
                        {spec ? reais.format(valorAluno) : "-"}
                        {spec ? <span className="block text-xs text-neutral-500">curso inteiro</span> : null}
                      </td>
                      <td className={`${celula} whitespace-nowrap text-right`}>
                        <button
                          type="button"
                          className="rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                          onClick={() => (aberto ? setFormulario(null) : alterarCurso(ui))}
                          aria-expanded={aberto}
                        >
                          {aberto ? "Fechar" : "Alterar"}
                        </button>{" "}
                        <button
                          type="button"
                          className="rounded border border-neutral-300 px-2 py-1 text-xs text-if-red hover:bg-if-red/10 dark:border-neutral-700"
                          onClick={() => excluirCurso(ui, nomeDoCurso)}
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                    {aberto && formulario && (
                      <tr>
                        <td colSpan={11} className="bg-neutral-50 px-3 py-3 dark:bg-neutral-900/60">
                          <FormularioCursoNovo
                            dados={formulario.dados}
                            novo={false}
                            catalogo={catalogo}
                            campi={campi}
                            cursosDoCampus={cursos.filter((c) => c.unidadeId === formulario.dados.unidadeId)}
                            anoBase0={anoBase0}
                            mudar={mudarRascunho}
                            escolher={escolherDoCatalogo}
                            onSalvar={salvarFormulario}
                            onCancelar={() => setFormulario(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {formulario?.id === null && (
                <tr>
                  <td colSpan={11} className="bg-neutral-50 px-3 py-3 dark:bg-neutral-900/60">
                    <FormularioCursoNovo
                      dados={formulario.dados}
                      novo
                      catalogo={catalogo}
                      campi={campi}
                      cursosDoCampus={cursos.filter((c) => c.unidadeId === formulario.dados.unidadeId)}
                      anoBase0={anoBase0}
                      mudar={mudarRascunho}
                      escolher={escolherDoCatalogo}
                      onSalvar={salvarFormulario}
                      onCancelar={() => setFormulario(null)}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={adicionarCurso} disabled={formulario?.id === null} className="rounded bg-if-green px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
            Adicionar curso
          </button>
          <button type="button" onClick={limparCenario} className="rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700">
            Limpar o cenário (cursos novos e paradas)
          </button>
        </div>
        <p className="text-xs text-neutral-500">O cenário fica guardado neste navegador: ao voltar, você continua de onde parou.</p>
        </div>
      </details>

      <details className="rounded-lg border border-neutral-200 p-4 text-sm text-neutral-700 dark:border-neutral-800 dark:text-neutral-300">
        <summary className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Como este simulador funciona</summary>
        <div className="mt-3 flex flex-col gap-2">
          <p>
            <strong>Ponto de partida.</strong> Cada turma da matriz de {anoCiclo} de {instituicao}, com os alunos que a MDO contou (matrículas de {anoBase0}), as datas de
            início e término, a carga horária, o peso e o valor da matrícula do ciclo. O primeiro ano da tabela é exatamente o valor de hoje.
          </p>
          <p>
            <strong>Três parcelas.</strong> "Já matriculados" são os alunos de hoje terminando o curso. "Reposição" são as turmas novas dos cursos que continuam sendo ofertados. Curso que abre uma turma por ano repete a turma mais recente, uma por ano, com o mesmo tamanho e a mesma duração; os demais repetem cada turma quando ela termina. "Cursos novos" são os que você acrescentou. O total é a soma das três; "Sobre manter tudo" compara com o cenário em que nada muda (todos os cursos
            continuam e nenhum curso novo abre).
          </p>
          <p>
            <strong>Cursos semestrais.</strong> Um curso que recebe turma em março e em agosto já aparece como dois ciclos nos dados de hoje, e cada um é reposto no seu mês. Num curso novo,
            escolha "2, curso semestral" em Entradas por ano: a segunda turma entra seis meses depois da primeira, e a duração aceita meio ano (0,5) para os cursos de um semestre.
          </p>
          <p>
            <strong>Parar de ofertar um curso.</strong> Tira as turmas novas a partir do ano escolhido. As turmas em andamento terminam, e os alunos retidos depois do término continuam
            contando pelo prazo do jubilamento. Abrir um curso novo e parar outros no mesmo câmpus mostra, juntos, o ganho e a perda.
          </p>
          <p>
            <strong>Os anos.</strong> Os anos que você digita são anos reais (quando a turma entra). A matriz de um ano usa a PNP de dois anos antes, por isso a tabela mostra o ciclo
            orçamentário (o ano real mais dois). Um aluno que termina em 2031 só deixa de pesar na matriz de 2033 em diante.
          </p>
          <p>
            <strong>Evasão e retidos.</strong> Até o término, os alunos diminuem pela evasão anual do instituto na modalidade (você pode trocar). Depois do término a maioria se forma e só uma
            parte continua matriculada; essa parte é medida nos próprios ciclos de hoje. A Matrícula Total é recalculada com a mesma regra da MDO.
          </p>
          <p>
            <strong>Filtros e medidas.</strong> Os filtros escolhem quais turmas entram na conta, e a reposição de cada curso continua sendo estimada com todas as turmas dele. Os cartões ficam sempre em reais; a escolha "Ver em" muda a tabela ano a ano, a tabela por câmpus e as colunas de anos dos cursos. Tudo isso fica guardado na simulação salva.
          </p>
          <p>
            <strong>De onde vêm os alunos de um ano.</strong> O + em frente a cada ano da tabela do cenário abre, logo abaixo dele, a lista de cursos que formam aquele ano, com as três parcelas de cada um e a soma por modalidade. Por exemplo, se 2029 cair em relação a 2027, a lista mostra quais cursos perderam alunos e se a queda vem dos que se formam ou de uma reposição menor.
          </p>
          <p>
            <strong>Por que o valor sobe ou desce.</strong> O quadro logo abaixo da tabela do cenário compara cada turma num ano e no anterior e diz a causa de cada diferença: turmas que se formaram,
            retidos que saem, evasão nas turmas em andamento, turmas recentes que passam a contar o ano inteiro, e as turmas que entram (reposição, cursos novos e reformulados). A soma das causas é
            exatamente a variação do total. Uma queda forte costuma ser a formatura de turmas grandes sem uma turma do mesmo tamanho entrando no lugar.
          </p>
          <p>
            <strong>Curso reformulado.</strong> Quando um curso de hoje ganha currículo novo (outra carga horária, por exemplo), cadastre o currículo novo em Cursos novos e reformulados (Adicionar curso) e marque
            &quot;Reformulado&quot;. As turmas dele entram na Reposição, como continuidade, e não em Cursos novos. Escolhendo em &quot;no lugar de&quot; o curso de hoje, ele deixa de receber turma a partir da
            primeira turma do currículo novo, sem precisar cadastrar uma parada.
          </p>
          <p>
            <strong>MOOC fixo.</strong> Em &quot;O horizonte e o que a projeção supõe&quot;, você pode manter os alunos MOOC num número por ano (de partida, o de hoje). Cada aluno MOOC vale o que vale hoje no câmpus, e a diferença para a projeção entra na Reposição.
          </p>
          <p>
            <strong>O que não está aqui.</strong> O valor da matrícula fica fixo no de hoje: a simulação não sabe quanto será o orçamento da Rede nem as matrículas dos outros institutos, que
            movem o valor de cada matrícula. Custo de professor, sala e laboratório também não entram: mede só o que a matriz repassa. Serve para ver a ordem de grandeza e a forma da curva,
            não para prometer um valor.
          </p>
        </div>
      </details>
    </div>
  );
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** O formulário de um curso novo ou reformulado, aberto logo abaixo da linha (ou no fim da tabela, para um curso que ainda não está nela). Só vale ao salvar. */
function FormularioCursoNovo({
  dados,
  novo,
  catalogo,
  campi,
  cursosDoCampus,
  anoBase0,
  mudar,
  escolher,
  onSalvar,
  onCancelar,
}: {
  dados: NovoCursoUI;
  novo: boolean;
  catalogo: ItemCatalogo[];
  campi: Array<{ id: number; nome: string }>;
  cursosDoCampus: Array<{ chave: string; curso: string; oferta: string }>;
  anoBase0: number;
  mudar: (m: Partial<NovoCursoUI>) => void;
  escolher: (idx: number) => void;
  onSalvar: () => void;
  onCancelar: () => void;
}) {
  const item = dados.catalogoIdx >= 0 ? catalogo[dados.catalogoIdx] : undefined;
  const busca = dados.busca.trim().toLowerCase();
  const resultados = busca
    ? catalogo
        .map((it, idx) => ({ it, idx }))
        .filter(({ it }) => it.curso.toLowerCase().includes(busca))
        .slice(0, 40)
    : [];
  const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600 dark:text-neutral-400";
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSalvar();
      }}
    >
      <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{novo ? "Novo curso no cenário" : "Alterar o curso"}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className={rotulo}>
          Câmpus
          <select value={dados.unidadeId} onChange={(e) => mudar({ unidadeId: Number(e.target.value), substitui: undefined })} className={campo}>
            {campi.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome.replace(/^CAMPUS( AVANÇADO)? /, "")}
              </option>
            ))}
          </select>
        </label>
        <div className={`${rotulo} relative sm:col-span-2`}>
          <label htmlFor={`busca-${dados.id}`}>Curso (da tabela de pesos)</label>
          {item && (
            <p className="text-sm font-normal text-neutral-900 dark:text-neutral-100">
              <strong>{item.curso === "*" ? "Qualquer FIC fora do catálogo" : item.curso}</strong>{" "}
              <span className="text-xs text-neutral-500">
                {item.tipoCurso.toLowerCase()}
                {item.tipoOferta !== "*" && item.tipoOferta !== "NÃO SE APLICA" ? `, ${item.tipoOferta.toLowerCase()}` : ""}, mínima {inteiro.format(item.chMinimaMec)} h, peso {decimal.format(item.pesoEfetivo)}
              </span>
            </p>
          )}
          <input
            id={`busca-${dados.id}`}
            autoFocus
            value={dados.busca}
            onChange={(e) => mudar({ busca: e.target.value })}
            placeholder={item ? "para trocar, digite parte de outro nome" : "digite parte do nome"}
            className={campo}
          />
          {resultados.length > 0 && (
            <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded border border-neutral-300 bg-white text-xs font-normal shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
              {resultados.map(({ it, idx }) => (
                <li key={idx}>
                  <button type="button" className="w-full px-2 py-1.5 text-left hover:bg-if-green/10" onClick={() => escolher(idx)}>
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">{it.curso === "*" ? "Qualquer FIC fora do catálogo" : it.curso}</span>
                    <span className="block text-neutral-500">
                      {it.tipoCurso.toLowerCase()}
                      {it.tipoOferta !== "*" && it.tipoOferta !== "NÃO SE APLICA" ? `, ${it.tipoOferta.toLowerCase()}` : ""}, mínima {inteiro.format(it.chMinimaMec)} h, peso {decimal.format(it.pesoEfetivo)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <label className={rotulo}>
          Modalidade
          <select value={dados.repasse} onChange={(e) => mudar({ repasse: e.target.value as Repasse })} className={campo}>
            {(Object.keys(ROTULO_REPASSE) as Repasse[]).map((r) => (
              <option key={r} value={r}>
                {MODALIDADE_CURTA[r]}
              </option>
            ))}
          </select>
        </label>
        <label className={rotulo}>
          Ano da 1ª turma
          <input
            type="number"
            min={anoBase0 + 1}
            max={anoBase0 + MAX_ANOS}
            value={dados.anoInicio}
            onChange={(e) => {
              const v = Math.min(anoBase0 + MAX_ANOS, Math.max(anoBase0 + 1, Math.round(Number(e.target.value) || dados.anoInicio)));
              mudar({ anoInicio: v, anoFim: Math.max(dados.anoFim, v) });
            }}
            className={`${campo} tabular-nums`}
          />
        </label>
        <label className={rotulo}>
          Mês de início
          <select value={dados.mes} onChange={(e) => mudar({ mes: Number(e.target.value) })} className={campo}>
            {MESES.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className={rotulo} title="Curso anual: uma turma por ano. Curso semestral: duas, a segunda seis meses depois da primeira.">
          Entradas por ano
          <select value={dados.entradas === 2 ? 2 : 1} onChange={(e) => mudar({ entradas: Number(e.target.value) === 2 ? 2 : 1 })} className={campo}>
            <option value={1}>1 por ano (curso anual)</option>
            <option value={2}>2 por ano (curso semestral)</option>
          </select>
        </label>
        <label className={rotulo}>
          Ingressantes por turma
          <input
            type="number"
            min={1}
            max={2000}
            value={dados.ingressantes}
            onChange={(e) => mudar({ ingressantes: Math.min(2000, Math.max(1, Math.round(Number(e.target.value) || 1))) })}
            className={`${campo} tabular-nums`}
          />
        </label>
        <label className={rotulo}>
          Duração em anos (0,5 é um semestre)
          <input
            type="number"
            min={0.1}
            max={10}
            step={0.5}
            value={dados.duracao}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) mudar({ duracao: Math.min(10, Math.max(0.1, v)) });
            }}
            className={`${campo} tabular-nums`}
          />
        </label>
        <label className={rotulo}>
          Oferta
          <select value={dados.continua === true ? "continua" : "ate"} onChange={(e) => mudar({ continua: e.target.value === "continua" })} className={campo}>
            <option value="continua">todo ano</option>
            <option value="ate">até um ano</option>
          </select>
        </label>
        {dados.continua !== true && (
          <label className={rotulo} title="Igual ao ano da primeira: uma turma só">
            Ano da última turma
            <input
              type="number"
              min={dados.anoInicio}
              max={anoBase0 + MAX_ANOS}
              value={dados.anoFim}
              onChange={(e) => mudar({ anoFim: Math.max(dados.anoInicio, Math.round(Number(e.target.value) || dados.anoInicio)) })}
              className={`${campo} tabular-nums`}
            />
          </label>
        )}
        <div className={`${rotulo} sm:col-span-2`}>
          <label className="flex items-center gap-1.5 text-sm font-normal text-neutral-800 dark:text-neutral-200">
            <input type="checkbox" checked={dados.reformulado === true} onChange={(e) => mudar({ reformulado: e.target.checked, substitui: e.target.checked ? dados.substitui : undefined })} />
            Reformulado (currículo novo de um curso que o câmpus já oferta)
          </label>
          {dados.reformulado && (
            <select value={dados.substitui ?? ""} onChange={(e) => mudar({ substitui: e.target.value || undefined })} className={campo} aria-label="Curso de hoje que ele substitui">
              <option value="">no lugar de... (opcional)</option>
              {cursosDoCampus.map((c) => (
                <option key={c.chave} value={c.chave}>
                  {c.curso}
                  {c.oferta && c.oferta !== "NÃO SE APLICA" ? ` (${c.oferta.toLowerCase()})` : ""}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      {!item && <p className="text-xs text-if-red">Escolha o curso na lista: sem ele, o curso não entra na conta e não pode ser salvo.</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={!item} className="rounded bg-if-green px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
          {novo ? "Incluir no cenário" : "Salvar alteração"}
        </button>
        <button type="button" onClick={onCancelar} className="rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Percentual({ rotulo, valor, onChange, padrao, ajuda }: { rotulo: string; valor: number; onChange: (v: number) => void; padrao: number; ajuda: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-neutral-700 dark:text-neutral-300">{rotulo}</span>
      <input
        type="number"
        min={0}
        max={80}
        step={0.5}
        value={valor}
        onChange={(e) => onChange(Math.min(80, Math.max(0, Number(e.target.value) || 0)))}
        className={campo}
      />
      <span className="text-xs text-neutral-500">
        {ajuda}
        {valor !== padrao && (
          <>
            {" "}
            <button type="button" onClick={() => onChange(padrao)} className="font-medium text-if-green underline">
              voltar a {decimal.format(padrao)}%
            </button>
          </>
        )}
      </span>
    </label>
  );
}


interface DetalheDoAnoDados {
  k: number;
  linhas: Array<{ chave: string; unidadeId: number; curso: string; oferta: string; repasse: Repasse; matric: number; repos: number; novos: number; contados: number; reformulado: boolean }>;
  porModalidade: Map<Repasse, number>;
}

const MODALIDADE_CURTA: Record<Repasse, string> = { PRESENCIAL: "Presencial", EAD_FP: "A distância, financ. próprio", EAD: "A distância, financ. externo", EAD_MOOC: "MOOC" };

/** O que abre abaixo de um ano da tabela do cenário: de que curso vem cada parcela, com a soma por modalidade. */
function DetalheDoAno({
  anoMatriz,
  anoPnp,
  detalhe,
  ajusteMooc,
  alvoMooc,
  comCampus,
  nomeDoCampus,
  medida,
  nomeDaMedida,
  formatar,
  completo,
  onCompleto,
}: {
  anoMatriz: number;
  anoPnp: number;
  detalhe: DetalheDoAnoDados;
  ajusteMooc: number;
  alvoMooc: number | null;
  comCampus: boolean;
  nomeDoCampus: (id: number) => string;
  medida: Medida;
  nomeDaMedida: string;
  formatar: (v: number) => string;
  completo: boolean;
  onCompleto: (v: boolean) => void;
}) {
  const LIMITE = 30;
  const visiveis = completo ? detalhe.linhas : detalhe.linhas.slice(0, LIMITE);
  const total = detalhe.linhas.reduce((s, l) => s + l.matric + l.repos + l.novos, 0) + ajusteMooc;
  const celula = "px-2 py-1 text-right tabular-nums";
  return (
    <div className="flex flex-col gap-2 text-xs text-neutral-700 dark:text-neutral-300">
      <p className="text-sm">
        <strong>De onde vêm os números da matriz de {anoMatriz}</strong> (alunos de {anoPnp}), em {nomeDaMedida}: {detalhe.linhas.length} curso(s), do maior para o menor.
      </p>
      <p className="flex flex-wrap gap-x-4 gap-y-1">
        {(["PRESENCIAL", "EAD_FP", "EAD", "EAD_MOOC"] as Repasse[])
          .filter((r) => detalhe.porModalidade.has(r) || (r === "EAD_MOOC" && Math.abs(ajusteMooc) > 1e-6))
          .map((r) => (
            <span key={r}>
              {MODALIDADE_CURTA[r]}: <strong className="tabular-nums">{formatar((detalhe.porModalidade.get(r) ?? 0) + (r === "EAD_MOOC" ? ajusteMooc : 0))}</strong>
            </span>
          ))}
      </p>
      <div className="tabela-rolavel">
        <table className="w-full">
          <thead className="text-left uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-2 py-1">Curso</th>
              {comCampus && <th className="px-2 py-1">Câmpus</th>}
              <th className="px-2 py-1">Modalidade</th>
              {medida === "reais" && <th className="px-2 py-1 text-right">Alunos que a MDO conta</th>}
              <th className="px-2 py-1 text-right">Já matriculados</th>
              <th className="px-2 py-1 text-right">Reposição</th>
              <th className="px-2 py-1 text-right">Cursos novos</th>
              <th className="px-2 py-1 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {visiveis.map((l) => (
              <tr key={l.chave}>
                <td className="px-2 py-1">
                  {l.curso}
                  {l.oferta && l.oferta !== "NÃO SE APLICA" && l.oferta !== "*" ? <span className="text-neutral-500"> ({l.oferta.toLowerCase()})</span> : null}
                  {l.novos !== 0 ? <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">novo</span> : null}
                  {l.reformulado ? <span className="ml-1 rounded bg-violet-100 px-1 text-[10px] font-medium text-violet-800 dark:bg-violet-900/40 dark:text-violet-300">reformulado</span> : null}
                </td>
                {comCampus && <td className="px-2 py-1 text-neutral-600 dark:text-neutral-400">{nomeDoCampus(l.unidadeId)}</td>}
                <td className="px-2 py-1 text-neutral-600 dark:text-neutral-400">{MODALIDADE_CURTA[l.repasse]}</td>
                {medida === "reais" && <td className={celula}>{inteiro.format(Math.round(l.contados))}</td>}
                <td className={celula}>{l.matric ? formatar(l.matric) : "-"}</td>
                <td className={celula}>{l.repos ? formatar(l.repos) : "-"}</td>
                <td className={celula}>{l.novos ? formatar(l.novos) : "-"}</td>
                <td className={`${celula} font-medium`}>{formatar(l.matric + l.repos + l.novos)}</td>
              </tr>
            ))}
            {alvoMooc !== null && Math.abs(ajusteMooc) > 1e-6 && (
              <tr className="bg-sky-50 dark:bg-sky-950/30">
                <td className="px-2 py-1" colSpan={comCampus ? 3 : 2}>
                  Ajuste para manter o MOOC em {inteiro.format(Math.round(alvoMooc))} alunos
                </td>
                {medida === "reais" && <td className={celula} />}
                <td className={celula}>-</td>
                <td className={celula}>{formatar(ajusteMooc)}</td>
                <td className={celula}>-</td>
                <td className={`${celula} font-medium`}>{formatar(ajusteMooc)}</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-neutral-300 font-semibold dark:border-neutral-700">
              <td className="px-2 py-1" colSpan={comCampus ? 3 : 2}>
                Total de {anoMatriz}
              </td>
              {medida === "reais" && <td className={celula} />}
              <td className={celula} colSpan={3} />
              <td className={celula}>{formatar(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {detalhe.linhas.length > LIMITE && (
        <button type="button" onClick={() => onCompleto(!completo)} className="self-start font-medium text-if-green underline">
          {completo ? `Mostrar só os ${LIMITE} maiores` : `Mostrar os ${detalhe.linhas.length} cursos`}
        </button>
      )}
      <p className="text-neutral-500">
        Cada linha junta as turmas de um curso no câmpus. &quot;Já matriculados&quot; são os alunos de hoje que ainda estão no curso nesse ano; &quot;Reposição&quot;, as turmas novas que o curso recebe por continuar sendo ofertado; &quot;Cursos novos&quot;, os que você acrescentou no cenário. O total é o mesmo da linha do ano na tabela acima.
      </p>
    </div>
  );
}

function Cartao({ titulo, valor, nota }: { titulo: string; valor: string; nota: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">{titulo}</span>
      <span className="text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">{valor}</span>
      <span className="text-xs text-neutral-600 dark:text-neutral-400">{nota}</span>
    </div>
  );
}
