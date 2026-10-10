"use client";

import { useEffect, useMemo, useState } from "react";
import { ContextoDaTela } from "@/components/chat/ChatDaTela";
import { useConfiguracaoSalvavel } from "@/components/configuracoes/ConfiguracoesSalvas";
import { PESO_REPASSE_PADRAO, type Repasse } from "@/lib/mdo/matriculaTotal";
import { chDaMatrizDoCurso } from "@/lib/mdo/valorDoCurso";
import {
  projetarMatriculados,
  situacaoDoCiclo,
  turmasDeCursoNovo,
  turmasDeReposicao,
  ciclosComSucessora,
  ultimoAnoDeTermino,
  type CicloProjetavel,
  type CursoNovo,
  type Premissas,
  type TurmaProjetada,
} from "@/lib/mdo/projecaoCiclos";

/** Um ciclo como vem do servidor: datas em texto, porque Date não atravessa para o componente de cliente. */
export interface CicloSerial {
  id: number;
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
}

/** Uma linha da tabela de pesos: o que o catálogo sabe de um curso, para abrir um curso novo no cenário. */
export interface ItemCatalogo {
  curso: string;
  tipoCurso: string;
  tipoOferta: string;
  chMinimaMec: number;
  pesoEfetivo: number;
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

function paraCiclo(c: CicloSerial): CicloProjetavel {
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
}
const linhasVazias = (n: number): LinhaAno[] => Array.from({ length: n }, () => ({ matric: 0, repos: 0, reposTudo: 0, novos: 0, alunos: 0 }));

export function ProjecaoCiclos({
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
}: {
  instituicao: string;
  anoCiclo: number;
  anoBase0: number;
  campi: Array<{ id: number; nome: string }>;
  ciclos: CicloSerial[];
  catalogo: ItemCatalogo[];
  valorMatriculaPresencial: number;
  taxasPadrao: TaxasPadrao;
  retencao: RetencaoPadrao;
  campusInicialId: number | null;
}) {
  const [campusId, setCampusId] = useState<number | null>(campusInicialId);
  const [anos, setAnos] = useState(5);
  const [evPresencial, setEvPresencial] = useState(Math.round(taxasPadrao.presencial * 1000) / 10);
  const [evEad, setEvEad] = useState(Math.round(taxasPadrao.ead * 1000) / 10);
  const [reporExistentes, setReporExistentes] = useState(true);
  const [encerramentos, setEncerramentos] = useState<Record<string, number>>({});
  const [novos, setNovos] = useState<NovoCursoUI[]>([]);
  const [anoEmLote, setAnoEmLote] = useState(anoBase0 + 3);
  const [filtroCurso, setFiltroCurso] = useState("");
  const [verTodosOsCursos, setVerTodosOsCursos] = useState(false);
  const [restaurado, setRestaurado] = useState(false);

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
    setNovos((Array.isArray(c.novos) ? c.novos : []).filter((n) => campi.some((x) => x.id === n.unidadeId)));
    if (c.campusId !== undefined) setCampusId(c.campusId !== null && campi.some((x) => x.id === c.campusId) ? c.campusId : null);
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
      const s: CenarioSalvo = { v: 1, anos, evPresencial, evEad, reporExistentes, encerramentos, novos, campusId };
      window.localStorage.setItem(chaveSalva, JSON.stringify(s));
    } catch {
      /* idem */
    }
  }, [restaurado, chaveSalva, anos, evPresencial, evEad, reporExistentes, encerramentos, novos, campusId]);

  // As simulações salvas no servidor (com nome, para compartilhar) usam o mesmo estado.
  useConfiguracaoSalvavel({
    chave: `simulador/projecao:${instituicao}:${anoCiclo}`,
    rotulo: "esta simulação",
    capturar: () => ({ v: 1, anos, evPresencial, evEad, reporExistentes, encerramentos, novos, campusId }) satisfies CenarioSalvo,
    aplicar: aplicarCenario,
  });

  const premissas = useMemo<Premissas>(
    () => ({ evasao: { presencial: evPresencial / 100, ead: evEad / 100 }, retencao: retencao.retencao }),
    [evPresencial, evEad, retencao],
  );
  const todos = useMemo(() => ciclos.map(paraCiclo), [ciclos]);

  // Os cálculos pesados (um por ciclo) só são refeitos quando muda o horizonte ou a evasão; mexer no cenário só refaz as somas.
  const matriculadosPorCiclo = useMemo(() => todos.map((c) => projetarMatriculados(c, anoBase0, anos, premissas)), [todos, anoBase0, anos, premissas]);
  const comSucessora = useMemo(() => ciclosComSucessora(todos), [todos]);
  const turmasPorCiclo = useMemo<TurmaProjetada[][]>(() => todos.map((c) => turmasDeReposicao(c, anoBase0, anos, premissas, comSucessora.has(c.id))), [todos, anoBase0, anos, premissas, comSucessora]);

  // Cursos novos: o que o catálogo sabe de cada um vira a especificação que o motor usa.
  const novosEspec = useMemo(
    () =>
      novos.map((n) => {
        const item = n.catalogoIdx >= 0 ? catalogo[n.catalogoIdx] : undefined;
        if (!item) return { ui: n, item: undefined, spec: undefined };
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
        return { ui: n, item, spec };
      }),
    [novos, catalogo, valorMatriculaPresencial, anoBase0, anos],
  );
  const turmasDosNovos = useMemo(
    () => novosEspec.map((e) => (e.spec ? turmasDeCursoNovo(e.spec, anoBase0, anos, premissas) : [])),
    [novosEspec, anoBase0, anos, premissas],
  );

  // Soma por câmpus, ano a ano: quem já está matriculado, a reposição dos cursos que continuam, os cursos novos.
  const porCampus = useMemo(() => {
    const m = new Map<number, LinhaAno[]>();
    const linhasDe = (u: number) => {
      let l = m.get(u);
      if (!l) {
        l = linhasVazias(anos);
        m.set(u, l);
      }
      return l;
    };
    todos.forEach((c, i) => {
      const l = linhasDe(c.unidadeId);
      matriculadosPorCiclo[i]!.forEach((p, k) => {
        l[k]!.matric += p.valor;
        l[k]!.alunos += p.alunosContados;
      });
      const parar = encerramentos[chaveDoCurso(c.unidadeId, c.curso, c.tipoOferta)];
      for (const t of turmasPorCiclo[i]!) {
        const conta = reporExistentes && (parar === undefined || t.anoEntrada <= parar - 1);
        t.pontos.forEach((p, k) => {
          l[k]!.reposTudo += p.valor;
          if (conta) {
            l[k]!.repos += p.valor;
            l[k]!.alunos += p.alunosContados;
          }
        });
      }
    });
    novosEspec.forEach((e, j) => {
      if (!e.spec) return;
      const l = linhasDe(e.ui.unidadeId);
      for (const t of turmasDosNovos[j]!) {
        t.pontos.forEach((p, k) => {
          l[k]!.novos += p.valor;
          l[k]!.alunos += p.alunosContados;
        });
      }
    });
    return m;
  }, [todos, matriculadosPorCiclo, turmasPorCiclo, novosEspec, turmasDosNovos, encerramentos, reporExistentes, anos]);

  const linhas = useMemo(() => {
    if (campusId !== null) return porCampus.get(campusId) ?? linhasVazias(anos);
    const soma = linhasVazias(anos);
    for (const l of porCampus.values()) {
      l.forEach((x, k) => {
        soma[k]!.matric += x.matric;
        soma[k]!.repos += x.repos;
        soma[k]!.reposTudo += x.reposTudo;
        soma[k]!.novos += x.novos;
        soma[k]!.alunos += x.alunos;
      });
    }
    return soma;
  }, [campusId, porCampus, anos]);

  const nomeDoRecorte = campusId === null ? instituicao : (campi.find((c) => c.id === campusId)?.nome ?? "");
  const ciclosDoRecorte = useMemo(() => todos.filter((c) => campusId === null || c.unidadeId === campusId), [todos, campusId]);

  // Por curso e câmpus: o que cada curso ainda rende só com os alunos de hoje, e a decisão de parar de ofertar.
  const cursos = useMemo(() => {
    const m = new Map<string, { chave: string; unidadeId: number; curso: string; oferta: string; ciclos: number; alunos: number; anoTermino: number; valores: number[] }>();
    for (const c of ciclosDoRecorte) {
      if (c.alunos <= 0) continue;
      const chave = chaveDoCurso(c.unidadeId, c.curso, c.tipoOferta);
      const i = todos.indexOf(c);
      const sit = situacaoDoCiclo(c, anoBase0);
      const atual = m.get(chave) ?? { chave, unidadeId: c.unidadeId, curso: c.curso, oferta: c.tipoOferta, ciclos: 0, alunos: 0, anoTermino: 0, valores: Array(anos).fill(0) as number[] };
      atual.ciclos += 1;
      atual.alunos += c.alunos;
      if (sit.regular) atual.anoTermino = Math.max(atual.anoTermino, sit.anoTermino);
      matriculadosPorCiclo[i]!.forEach((p, k) => {
        atual.valores[k]! += p.valor;
      });
      m.set(chave, atual);
    }
    return [...m.values()].sort((a, b) => b.valores[0]! - a.valores[0]!);
  }, [ciclosDoRecorte, todos, anoBase0, anos, matriculadosPorCiclo]);

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

  function adicionarCurso() {
    setNovos((atual) => [
      ...atual,
      {
        id: Date.now() + atual.length,
        unidadeId: campusId ?? campi[0]?.id ?? 0,
        catalogoIdx: -1,
        busca: "",
        anoInicio: anoBase0 + 2,
        mes: 3,
        entradas: 1,
        anoFim: anoBase0 + 2,
        continua: true,
        ingressantes: 40,
        duracao: 3,
        repasse: "PRESENCIAL",
      },
    ]);
  }
  function mudarCurso(id: number, mudanca: Partial<NovoCursoUI>) {
    setNovos((atual) => atual.map((n) => (n.id === id ? { ...n, ...mudanca } : n)));
  }
  function escolherDoCatalogo(id: number, idx: number) {
    const item = catalogo[idx];
    if (!item) return;
    const sugerida = duracaoObservada.get(`${item.curso}|${item.tipoOferta}`) || duracaoPadrao(item.tipoCurso, item.tipoOferta);
    mudarCurso(id, { catalogoIdx: idx, duracao: sugerida });
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
    setReporExistentes(true);
  }

  const fimDoHorizonte = anoBase0 + anos - 1;
  const comAlunos = ciclosDoRecorte.filter((c) => c.alunos > 0);
  const regulares = comAlunos.filter((c) => situacaoDoCiclo(c, anoBase0).regular);
  const atrasados = comAlunos.filter((c) => !situacaoDoCiclo(c, anoBase0).regular);
  // Um curso que continua sendo ofertado não tem "último término": para sugerir o horizonte, conta só a primeira turma dele.
  const novosDoRecorte = novosEspec
    .filter((e) => e.spec && (campusId === null || e.ui.unidadeId === campusId))
    .map((e) => (e.ui.continua === true ? { ...e.spec!, ultimoAnoEntrada: e.spec!.primeiroAnoEntrada } : e.spec!));
  const ultimoNecessario = ultimoAnoDeTermino(ciclosDoRecorte, novosDoRecorte, anoBase0);

  const total = (f: (l: LinhaAno) => number) => linhas.reduce((s, l) => s + f(l), 0);
  const totalMatric = total((l) => l.matric);
  const totalCenario = total((l) => l.matric + l.repos + l.novos);
  const totalManter = total((l) => l.matric + l.reposTudo);
  const diferenca = totalCenario - totalManter;
  const maxAno = Math.max(...linhas.map((l) => l.matric + l.repos + l.novos), 1);
  const primeiro = linhas[0] ? linhas[0].matric + linhas[0].repos + linhas[0].novos : 0;
  const quantosParados = Object.keys(encerramentos).filter((k) => campusId === null || k.startsWith(`${campusId}|`)).length;

  const textoParaOChat = [
    `Cenário de ${nomeDoRecorte}, ciclos orçamentários ${anoCiclo} a ${anoCiclo + anos - 1}.`,
    `Evasão anual: ${decimal.format(evPresencial)}% presencial e ${decimal.format(evEad)}% a distância. Repor as turmas dos cursos existentes: ${reporExistentes ? "sim" : "não"}. Cursos que deixam de ser ofertados: ${quantosParados}. Cursos novos: ${novosDoRecorte.length}.`,
    ...linhas.map(
      (l, k) =>
        `${anoCiclo + k}: matriculados hoje ${reais.format(l.matric)}, reposição ${reais.format(l.repos)}, cursos novos ${reais.format(l.novos)}, total ${reais.format(l.matric + l.repos + l.novos)}.`,
    ),
    `Total do cenário: ${reais.format(totalCenario)}; manter tudo como está: ${reais.format(totalManter)}; diferença ${comSinal(diferenca)}. Para os matriculados terminarem: ${reais.format(totalMatric)}.`,
  ].join("\n");

  return (
    <div className="flex flex-col gap-6">
      <ContextoDaTela texto={textoParaOChat} />

      <section className="grid gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800 sm:grid-cols-2 lg:grid-cols-4">
        <h2 className="col-span-full text-sm font-semibold text-neutral-900 dark:text-neutral-100">1. O horizonte e o que a projeção supõe</h2>
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
            Ciclos orçamentários de {anoCiclo} a {anoCiclo + anos - 1}. De 1 a {MAX_ANOS}.{" "}
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
      </section>

      <section className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Câmpus que você está vendo (os cursos novos e as paradas valem para o câmpus de cada um)</span>
        <div className="flex flex-wrap gap-1">
          <BotaoCampus ativo={campusId === null} onClick={() => setCampusId(null)}>
            {instituicao} inteiro
          </BotaoCampus>
          {campi.map((c) => (
            <BotaoCampus key={c.id} ativo={campusId === c.id} onClick={() => setCampusId(c.id)}>
              {c.nome.replace(/^CAMPUS( AVANÇADO)? /, "")}
            </BotaoCampus>
          ))}
        </div>
      </section>

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
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">2. Cenário ano a ano, {nomeDoRecorte}</h2>
        <div className="tabela-rolavel">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-3 py-2">Ciclo orçamentário</th>
                <th className="px-3 py-2">Dado da PNP de</th>
                <th className="px-3 py-2 text-right">Alunos que a MDO conta</th>
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
                return (
                  <tr key={k} className={k === 0 ? "bg-neutral-50 dark:bg-neutral-900" : ""}>
                    <td className="px-3 py-2 font-medium">
                      {anoCiclo + k}
                      {k === 0 && <span className="ml-2 text-xs font-normal text-neutral-500">hoje</span>}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{anoBase0 + k}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{inteiro.format(Math.round(l.alunos))}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{reais.format(l.matric)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-neutral-600 dark:text-neutral-400">{reais.format(l.repos)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-neutral-600 dark:text-neutral-400">{reais.format(l.novos)}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{reais.format(totalAno)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${Math.abs(dif) < 1 ? "text-neutral-400" : dif > 0 ? "text-if-green" : "text-if-red dark:text-red-400"}`}>
                      {Math.abs(dif) < 1 ? "-" : comSinal(dif)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex h-3 w-full overflow-hidden rounded bg-neutral-100 dark:bg-neutral-800" title="Verde: já matriculados. Azul: reposição. Âmbar: cursos novos.">
                        <div className="bg-if-green" style={{ width: `${(l.matric / maxAno) * 100}%` }} />
                        <div className="bg-sky-500" style={{ width: `${(l.repos / maxAno) * 100}%` }} />
                        <div className="bg-amber-500" style={{ width: `${(l.novos / maxAno) * 100}%` }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-neutral-500">
          Valores em reais de hoje, com o valor da matrícula de cada ciclo como está no ciclo {anoCiclo}. {primeiro > 0 ? "" : ""}
          Os anos que você digita nos cursos novos e nas paradas são anos reais do curso (quando a turma entra); a matriz de cada ano usa os dados de dois anos antes, por isso a
          primeira coluna é o ciclo orçamentário (o ano real mais dois).
        </p>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">3. Cursos que deixam de ser ofertados</h2>
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
          <label className="flex flex-col gap-1 text-xs text-neutral-600 dark:text-neutral-400">
            Parar tudo o que está listado a partir de
            <input type="number" min={anoBase0 + 1} max={anoBase0 + MAX_ANOS} value={anoEmLote} onChange={(e) => setAnoEmLote(Number(e.target.value))} className={campo} />
          </label>
          <button
            type="button"
            className="rounded bg-if-green px-3 py-1.5 text-sm font-medium text-white"
            onClick={() => {
              setEncerramentos((atual) => {
                const novo = { ...atual };
                for (const c of cursosFiltrados) novo[c.chave] = anoEmLote;
                return novo;
              });
            }}
          >
            Aplicar aos {cursosFiltrados.length} curso(s) listados
          </button>
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
                <th className="px-3 py-2 text-right">Ciclos</th>
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
                <tr key={c.chave} className={encerramentos[c.chave] !== undefined ? "bg-amber-50 dark:bg-amber-950/30" : ""}>
                  <td className="px-3 py-2">
                    {c.curso}
                    {c.oferta && c.oferta !== "NÃO SE APLICA" ? <span className="text-xs text-neutral-500"> ({c.oferta.toLowerCase()})</span> : null}
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
                  </td>
                  {c.valores.slice(0, Math.min(anos, 6)).map((v, k) => (
                    <td key={k} className="px-3 py-2 text-right tabular-nums">
                      {v > 0 ? reais.format(v) : <span className="text-neutral-400">-</span>}
                    </td>
                  ))}
                </tr>
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
          As colunas de anos mostram só quem já está matriculado (até seis anos); o efeito de parar um curso aparece na tabela do cenário, na coluna Reposição e em Sobre manter tudo.
          "Atrasado" quer dizer que todos os ciclos do curso já passaram do término.
        </p>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">4. Cursos novos</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Acrescente os cursos que um câmpus pretende abrir. Escolha o curso na tabela de pesos (o peso e a carga horária vêm dela), o ano e o mês da primeira turma, quantos
          ingressantes entram em cada turma e, se a oferta se repete, até que ano ela entra. Curso semestral: escolha duas entradas por ano. A duração vem dos cursos parecidos que o instituto já oferta; ajuste se precisar.
        </p>
        {novosEspec.map(({ ui, item, spec }) => {
          const resultados = ui.busca.trim()
            ? catalogo
                .map((it, idx) => ({ it, idx }))
                .filter(({ it }) => it.curso.toLowerCase().includes(ui.busca.trim().toLowerCase()))
                .slice(0, 40)
            : [];
          const valorAluno = spec ? (spec.peso * (spec.chMatriz / 800) * spec.valorPorMT) : 0;
          return (
            <div key={ui.id} className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="flex flex-col gap-1 text-xs text-neutral-600 dark:text-neutral-400">
                  Câmpus
                  <select value={ui.unidadeId} onChange={(e) => mudarCurso(ui.id, { unidadeId: Number(e.target.value) })} className={campo}>
                    {campi.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome.replace(/^CAMPUS( AVANÇADO)? /, "")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-neutral-600 dark:text-neutral-400 lg:col-span-2">
                  Curso (digite parte do nome e escolha)
                  <input value={ui.busca} onChange={(e) => mudarCurso(ui.id, { busca: e.target.value })} placeholder={item ? `${item.curso}` : "ex.: informática"} className={campo} />
                  {resultados.length > 0 && (
                    <select
                      size={Math.min(6, resultados.length)}
                      className={campo}
                      onChange={(e) => {
                        escolherDoCatalogo(ui.id, Number(e.target.value));
                        mudarCurso(ui.id, { busca: "" });
                      }}
                      aria-label="Resultados da busca de curso"
                    >
                      {resultados.map(({ it, idx }) => (
                        <option key={idx} value={idx}>
                          {it.curso === "*" ? "Qualquer FIC fora do catálogo" : it.curso} ({it.tipoCurso.toLowerCase()}
                          {it.tipoOferta !== "*" && it.tipoOferta !== "NÃO SE APLICA" ? `, ${it.tipoOferta.toLowerCase()}` : ""}, mínima {inteiro.format(it.chMinimaMec)} h, peso {decimal.format(it.pesoEfetivo)})
                        </option>
                      ))}
                    </select>
                  )}
                </label>
                <label className="flex flex-col gap-1 text-xs text-neutral-600 dark:text-neutral-400">
                  Modalidade
                  <select value={ui.repasse} onChange={(e) => mudarCurso(ui.id, { repasse: e.target.value as Repasse })} className={campo}>
                    {(Object.keys(ROTULO_REPASSE) as Repasse[]).map((r) => (
                      <option key={r} value={r}>
                        {ROTULO_REPASSE[r]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
                <label className="flex flex-col gap-1 text-xs text-neutral-600 dark:text-neutral-400" title="Curso anual: uma turma por ano. Curso semestral: duas, a segunda seis meses depois da primeira.">
                  Entradas por ano
                  <select value={ui.entradas === 2 ? 2 : 1} onChange={(e) => mudarCurso(ui.id, { entradas: Number(e.target.value) === 2 ? 2 : 1 })} className={campo}>
                    <option value={1}>1, curso anual</option>
                    <option value={2}>2, curso semestral</option>
                  </select>
                </label>
                <Numero rotulo="Primeira turma (ano)" valor={ui.anoInicio} min={anoBase0 + 1} max={anoBase0 + MAX_ANOS} onChange={(v) => mudarCurso(ui.id, { anoInicio: v, anoFim: Math.max(ui.anoFim, v) })} />
                <label className="flex flex-col gap-1 text-xs text-neutral-600 dark:text-neutral-400">
                  Mês de início
                  <select value={ui.mes} onChange={(e) => mudarCurso(ui.id, { mes: Number(e.target.value) })} className={campo}>
                    {["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"].map((m, i) => (
                      <option key={m} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400 sm:col-span-2">
                  <input type="checkbox" checked={ui.continua === true} onChange={(e) => mudarCurso(ui.id, { continua: e.target.checked })} />
                  Continua sendo ofertado: entra uma turma nova a cada ano (a cada semestre, se semestral) até o fim do horizonte
                </label>
                {ui.continua !== true && (
                  <Numero rotulo="Última turma (ano)" valor={ui.anoFim} min={ui.anoInicio} max={anoBase0 + MAX_ANOS} onChange={(v) => mudarCurso(ui.id, { anoFim: Math.max(v, ui.anoInicio) })} ajuda="Igual ao ano da primeira: uma turma só" />
                )}
                <Numero rotulo="Ingressantes por turma" valor={ui.ingressantes} min={1} max={2000} onChange={(v) => mudarCurso(ui.id, { ingressantes: v })} />
                <Numero rotulo="Duração (anos; 0,5 = um semestre)" valor={ui.duracao} min={0.1} max={10} passo={0.5} onChange={(v) => mudarCurso(ui.id, { duracao: v })} />
                <div className="flex items-end">
                  <button type="button" className="w-full rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700" onClick={() => setNovos((a) => a.filter((n) => n.id !== ui.id))}>
                    Remover este curso
                  </button>
                </div>
              </div>
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                {item && spec
                  ? `${item.curso === "*" ? "Qualquer FIC fora do catálogo" : item.curso}: peso ${decimal.format(item.pesoEfetivo)}, mínima do MEC ${inteiro.format(item.chMinimaMec)} h, carga horária que vale ${inteiro.format(spec.chMatriz)} h. Um aluno que faz o curso inteiro rende cerca de ${reais.format(valorAluno)}. Entram ${spec.ingressantes} alunos por turma, ${ui.entradas === 2 ? "duas vezes por ano (semestral)" : "uma vez por ano"}, de ${ui.anoInicio} a ${spec.ultimoAnoEntrada}.`
                  : "Escolha o curso na busca acima: sem isso, ele não entra na conta."}
              </p>
            </div>
          );
        })}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={adicionarCurso} className="rounded bg-if-green px-3 py-1.5 text-sm font-medium text-white">
            Adicionar um curso novo
          </button>
          <button type="button" onClick={limparCenario} className="rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700">
            Limpar o cenário (cursos novos e paradas)
          </button>
        </div>
        <p className="text-xs text-neutral-500">O cenário fica guardado neste navegador: ao voltar, você continua de onde parou.</p>
      </section>

      {campusId === null && (
        <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">5. Total do cenário por câmpus</h2>
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
                          {reais.format(x.matric + x.repos + x.novos)}
                        </td>
                      ))}
                      <td className={`px-3 py-2 text-right tabular-nums ${Math.abs(t - m) < 1 ? "text-neutral-400" : t > m ? "text-if-green" : "text-if-red dark:text-red-400"}`}>
                        {Math.abs(t - m) < 1 ? "-" : comSinal(t - m)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <details open className="rounded-lg border border-neutral-200 p-4 text-sm text-neutral-700 dark:border-neutral-800 dark:text-neutral-300">
        <summary className="cursor-pointer text-sm font-semibold text-neutral-900 dark:text-neutral-100">Como este simulador funciona</summary>
        <div className="mt-3 flex flex-col gap-2">
          <p>
            <strong>Ponto de partida.</strong> Cada ciclo de curso do ciclo orçamentário {anoCiclo} de {instituicao}, com os alunos que a MDO contou (matrículas de {anoBase0}), as datas de
            início e término, a carga horária, o peso e o valor da matrícula do ciclo. O primeiro ano da tabela é exatamente o valor de hoje.
          </p>
          <p>
            <strong>Três parcelas.</strong> "Já matriculados" são os alunos de hoje terminando o curso. "Reposição" são as turmas novas dos cursos que continuam sendo ofertados, no tamanho da
            matrícula de entrada de hoje. "Cursos novos" são os que você acrescentou. O total é a soma das três; "Sobre manter tudo" compara com o cenário em que nada muda (todos os cursos
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
            <strong>O que não está aqui.</strong> O valor da matrícula fica fixo no de hoje: a simulação não sabe quanto será o orçamento da Rede nem as matrículas dos outros institutos, que
            movem o valor de cada matrícula. Custo de professor, sala e laboratório também não entram: mede só o que a matriz repassa. Serve para ver a ordem de grandeza e a forma da curva,
            não para prometer um valor.
          </p>
        </div>
      </details>
    </div>
  );
}

function Numero({
  rotulo,
  valor,
  min,
  max,
  passo,
  onChange,
  ajuda,
}: {
  rotulo: string;
  valor: number;
  min: number;
  max: number;
  passo?: number;
  onChange: (v: number) => void;
  ajuda?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-neutral-600 dark:text-neutral-400" title={ajuda}>
      {rotulo}
      <input
        type="number"
        min={min}
        max={max}
        step={passo ?? 1}
        value={Number.isFinite(valor) ? valor : ""}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)));
        }}
        className={campo}
      />
    </label>
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

function BotaoCampus({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={`rounded px-2 py-1 text-xs font-medium ${
        ativo ? "bg-if-green text-white" : "border border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
      }`}
    >
      {children}
    </button>
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
