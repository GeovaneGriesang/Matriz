"use client";

import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiUrl } from "@/lib/basePath";
import { DEFASAGEM_ANOS_REFERENCIA_PNP } from "@/server/config/orcamentoAnual.constants";
import type { RappAnualResumo } from "@/app/api/rapp-anual/route";
import type { MatriculaTotalEqualizadaResumo } from "@/app/api/matricula-total-equalizada/route";
import type { EficienciaAcademicaAnualResumo } from "@/app/api/eficiencia-academica-anual/route";
import type { OrcamentoDistribuidoOficialResumo } from "@/app/api/orcamento-distribuido-oficial/route";

type Origem = "PLANILHA" | "CONFIGURADO" | null;

const URL_PNP = "https://www.gov.br/mec/pt-br/pnp";

function LinkPnp({ children = "PNP" }: { children?: ReactNode }) {
  return (
    <a
      href={URL_PNP}
      target="_blank"
      rel="noreferrer"
      className="underline hover:text-neutral-900 dark:hover:text-neutral-100"
    >
      {children}
    </a>
  );
}

const CAMPO_MATRICULA = [
  { chave: "matriculaTotalPresencialEqualizada", label: "Presencial" },
  { chave: "matriculaTotalEadEqualizada", label: "EaD" },
  { chave: "matriculaTotalEadMoocEqualizada", label: "EaD MOOC" },
  { chave: "matriculaTotalEadFpEqualizada", label: "EaD FP" },
] as const;

const CAMPO_EFICIENCIA_ACADEMICA = [
  { chave: "conclusaoCiclo", label: "Conclusão Ciclo" },
  { chave: "evasaoCiclo", label: "Evasão Ciclo" },
  { chave: "retencaoCiclo", label: "Retenção Ciclo" },
  { chave: "eficienciaAcademica", label: "Eficiência Acadêmica" },
] as const;

const CAMPO_ORCAMENTO_OFICIAL = [
  { chave: "custeioOficial", label: "Custeio oficial" },
  { chave: "assistenciaOficial", label: "Assistência oficial" },
] as const;

const formatoNumero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 5 });

function OrigemBadge({ origem }: { origem: Origem }) {
  if (origem === null) {
    return <span className="text-xs text-neutral-400 dark:text-neutral-600">Não cadastrado</span>;
  }
  const label = origem === "PLANILHA" ? "Planilha oficial (CONIF)" : "Configurado à mão";
  const classes =
    origem === "PLANILHA"
      ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
      : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  return <span className={`w-fit rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}>{label}</span>;
}

function ValorCalculado({ valor }: { valor: number | null }) {
  if (valor === null) return <span className="text-neutral-400 dark:text-neutral-600">—</span>;
  return <span className="italic text-neutral-500 dark:text-neutral-400">{formatoNumero.format(valor)}</span>;
}

function ItemMemoria({ children }: { children: ReactNode }) {
  return <li className="text-neutral-700 dark:text-neutral-300">{children}</li>;
}

function BotaoMemoria({ aberto, onClick }: { aberto: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs font-medium text-neutral-500 underline hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100"
    >
      {aberto ? "Ocultar cálculo" : "Ver como foi calculado"}
    </button>
  );
}

function useFiltro<T>(linhas: T[], busca: string, chaveTexto: (item: T) => string): T[] {
  return useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return linhas;
    return linhas.filter((l) => chaveTexto(l).toLowerCase().includes(termo));
  }, [linhas, busca, chaveTexto]);
}

function CaixaBusca({ busca, onChange }: { busca: string; onChange: (valor: string) => void }) {
  return (
    <input
      type="text"
      placeholder="Filtrar por instituição, câmpus ou sigla..."
      value={busca}
      onChange={(e) => onChange(e.target.value)}
      className="min-w-64 flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
    />
  );
}

function MatriculaTotalEqualizadaTabela({ ano }: { ano: number }) {
  const [linhas, setLinhas] = useState<MatriculaTotalEqualizadaResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    setCarregando(true);
    fetch(apiUrl(`/api/matricula-total-equalizada?ano=${ano}`))
      .then((r) => (r.ok ? (r.json() as Promise<MatriculaTotalEqualizadaResumo[]>) : []))
      .then(setLinhas)
      .catch(() => setLinhas([]))
      .finally(() => setCarregando(false));
  }, [ano]);

  const linhasFiltradas = useFiltro(linhas, busca, (l) => `${l.unidadeNome} ${l.instituicaoSigla}`);

  if (carregando) return <p className="text-sm text-neutral-500 dark:text-neutral-400">Carregando...</p>;

  return (
    <div className="flex flex-col gap-3">
      <CaixaBusca busca={busca} onChange={setBusca} />
      <div className="max-h-[32rem] overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-neutral-50 text-left dark:bg-neutral-900">
            <tr>
              <th className="px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400">Instituição</th>
              <th className="px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400">Câmpus</th>
              {CAMPO_MATRICULA.map((c) => (
                <th key={c.chave} className="px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400">
                  {c.label}
                </th>
              ))}
              <th className="px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400">Origem</th>
              <th className="px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400">
                Matríc. Equiv. calculada (PNP {ano - DEFASAGEM_ANOS_REFERENCIA_PNP})
              </th>
            </tr>
          </thead>
          <tbody>
            {linhasFiltradas.map((l) => (
              <tr key={l.unidadeId} className="border-t border-neutral-200 dark:border-neutral-800">
                <td className="px-3 py-2 text-neutral-600 dark:text-neutral-400">{l.instituicaoSigla}</td>
                <td className="px-3 py-2 text-neutral-900 dark:text-neutral-100">{l.unidadeNome}</td>
                {CAMPO_MATRICULA.map((c) => (
                  <td key={c.chave} className="px-3 py-2 text-neutral-900 dark:text-neutral-100">
                    {formatoNumero.format(l[c.chave])}
                  </td>
                ))}
                <td className="px-3 py-2">
                  <OrigemBadge origem={l.origem} />
                </td>
                <td className="px-3 py-2">
                  <ValorCalculado valor={l.matriculaEquivalenteGeralCalculada} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        {linhasFiltradas.length} de {linhas.length} câmpus — ano-base {ano}. A coluna calculada não é resultado de
        uma fórmula: é a Matrícula Equivalente | Geral bruta da <LinkPnp>PNP</LinkPnp> (ano {ano - DEFASAGEM_ANOS_REFERENCIA_PNP}
        ), o mesmo valor que o motor de cálculo usa como substituto quando não há Matrícula Total equalizada oficial
        cadastrada — não é decomposta em Presencial/EaD como as colunas oficiais.
      </p>
    </div>
  );
}

function RappAnualTabela({ ano }: { ano: number }) {
  const [linhas, setLinhas] = useState<RappAnualResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());
  const anoPnp = ano - DEFASAGEM_ANOS_REFERENCIA_PNP;

  useEffect(() => {
    setCarregando(true);
    fetch(apiUrl(`/api/rapp-anual?ano=${ano}`))
      .then((r) => (r.ok ? (r.json() as Promise<RappAnualResumo[]>) : []))
      .then(setLinhas)
      .catch(() => setLinhas([]))
      .finally(() => setCarregando(false));
  }, [ano]);

  const linhasFiltradas = useFiltro(linhas, busca, (l) => `${l.instituicaoNome} ${l.instituicaoSigla}`);

  function alternar(instituicaoId: number) {
    setExpandidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(instituicaoId)) novo.delete(instituicaoId);
      else novo.add(instituicaoId);
      return novo;
    });
  }

  if (carregando) return <p className="text-sm text-neutral-500 dark:text-neutral-400">Carregando...</p>;

  return (
    <div className="flex flex-col gap-3">
      <CaixaBusca busca={busca} onChange={setBusca} />
      <div className="max-h-[28rem] overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-neutral-50 text-left dark:bg-neutral-900">
            <tr>
              <th className="px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400">Sigla</th>
              <th className="px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400">Instituição</th>
              <th className="px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400">RAPP</th>
              <th className="px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400">Origem</th>
              <th className="px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400">
                RAPP calculado (PNP {anoPnp})
              </th>
              <th className="px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400"></th>
            </tr>
          </thead>
          <tbody>
            {linhasFiltradas.map((l) => {
              const aberto = expandidos.has(l.instituicaoId);
              return (
                <Fragment key={l.instituicaoId}>
                  <tr className="border-t border-neutral-200 dark:border-neutral-800">
                    <td className="px-3 py-2 text-neutral-600 dark:text-neutral-400">{l.instituicaoSigla}</td>
                    <td className="px-3 py-2 text-neutral-900 dark:text-neutral-100">{l.instituicaoNome}</td>
                    <td className="px-3 py-2 text-neutral-900 dark:text-neutral-100">{formatoNumero.format(l.rapp)}</td>
                    <td className="px-3 py-2">
                      <OrigemBadge origem={l.origem} />
                    </td>
                    <td className="px-3 py-2">
                      <ValorCalculado valor={l.rapCalculado?.razaoDocenteAluno ?? null} />
                    </td>
                    <td className="px-3 py-2">
                      {l.rapCalculado && <BotaoMemoria aberto={aberto} onClick={() => alternar(l.instituicaoId)} />}
                    </td>
                  </tr>
                  {aberto && l.rapCalculado && (
                    <tr className="border-t border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
                      <td colSpan={6} className="px-3 py-3">
                        <ul className="list-disc space-y-1 pl-5 text-xs">
                          <ItemMemoria>
                            Fonte dos dados brutos: <LinkPnp>PNP</LinkPnp> (Plataforma Nilo Peçanha), ano de
                            referência {anoPnp} — arquivos <code>RelacaoAlunoProfessorRAP.csv</code> e{" "}
                            <code>TaxaEvasao.csv</code>.
                          </ItemMemoria>
                          <ItemMemoria>
                            Matrículas Presenciais {formatoNumero.format(l.rapCalculado.matriculasPresenciais)} ÷
                            Professor Equivalente {formatoNumero.format(l.rapCalculado.professorEquivalente)} (somas
                            de todos os câmpus da instituição) = RAPP calculado{" "}
                            <strong>{formatoNumero.format(l.rapCalculado.razaoDocenteAluno)}</strong>
                          </ItemMemoria>
                          <ItemMemoria>
                            Aproximação: o numerador oficial (Portaria SETEC/MEC nº 51/2018) é a
                            Matrícula-equivalente presencial, ponderada por Fator de Esforço de Curso — aqui usamos a
                            matrícula bruta presencial, porque essa ponderação não está disponível hoje. Erro
                            esperado entre +0,9% e +53% dependendo da instituição.
                          </ItemMemoria>
                        </ul>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        {linhasFiltradas.length} de {linhas.length} instituições — ano-base {ano}.
      </p>
    </div>
  );
}

function EficienciaAcademicaAnualTabela({ ano }: { ano: number }) {
  const [linhas, setLinhas] = useState<EficienciaAcademicaAnualResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());
  const anoPnp = ano - DEFASAGEM_ANOS_REFERENCIA_PNP;
  const colspan = 2 + CAMPO_EFICIENCIA_ACADEMICA.length * 2 + 1;

  useEffect(() => {
    setCarregando(true);
    fetch(apiUrl(`/api/eficiencia-academica-anual?ano=${ano}`))
      .then((r) => (r.ok ? (r.json() as Promise<EficienciaAcademicaAnualResumo[]>) : []))
      .then(setLinhas)
      .catch(() => setLinhas([]))
      .finally(() => setCarregando(false));
  }, [ano]);

  const linhasFiltradas = useFiltro(linhas, busca, (l) => `${l.instituicaoNome} ${l.instituicaoSigla}`);

  function alternar(instituicaoId: number) {
    setExpandidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(instituicaoId)) novo.delete(instituicaoId);
      else novo.add(instituicaoId);
      return novo;
    });
  }

  if (carregando) return <p className="text-sm text-neutral-500 dark:text-neutral-400">Carregando...</p>;

  return (
    <div className="flex flex-col gap-3">
      <CaixaBusca busca={busca} onChange={setBusca} />
      <div className="max-h-[32rem] overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-neutral-50 text-left dark:bg-neutral-900">
            <tr>
              <th className="px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400">Sigla</th>
              <th className="px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400">Instituição</th>
              {CAMPO_EFICIENCIA_ACADEMICA.map((c) => (
                <th key={c.chave} className="px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400">
                  {c.label}
                </th>
              ))}
              <th className="px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400">Origem</th>
              {CAMPO_EFICIENCIA_ACADEMICA.map((c) => (
                <th key={`calc-${c.chave}`} className="px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400">
                  {c.label} (calc. PNP {anoPnp})
                </th>
              ))}
              <th className="px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400"></th>
            </tr>
          </thead>
          <tbody>
            {linhasFiltradas.map((l) => {
              const aberto = expandidos.has(l.instituicaoId);
              const calc = l.eficienciaAcademicaCalculada;
              return (
                <Fragment key={l.instituicaoId}>
                  <tr className="border-t border-neutral-200 dark:border-neutral-800">
                    <td className="px-3 py-2 text-neutral-600 dark:text-neutral-400">{l.instituicaoSigla}</td>
                    <td className="px-3 py-2 text-neutral-900 dark:text-neutral-100">{l.instituicaoNome}</td>
                    {CAMPO_EFICIENCIA_ACADEMICA.map((c) => (
                      <td key={c.chave} className="px-3 py-2 text-neutral-900 dark:text-neutral-100">
                        {formatoNumero.format(l[c.chave])}
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <OrigemBadge origem={l.origem} />
                    </td>
                    {CAMPO_EFICIENCIA_ACADEMICA.map((c) => (
                      <td key={`calc-${c.chave}`} className="px-3 py-2">
                        <ValorCalculado valor={calc ? calc[c.chave] : null} />
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      {calc && <BotaoMemoria aberto={aberto} onClick={() => alternar(l.instituicaoId)} />}
                    </td>
                  </tr>
                  {aberto && calc && (
                    <tr className="border-t border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
                      <td colSpan={colspan} className="px-3 py-3">
                        <ul className="list-disc space-y-1 pl-5 text-xs">
                          <ItemMemoria>
                            Fonte dos dados brutos: <LinkPnp>PNP</LinkPnp> (Plataforma Nilo Peçanha), ano de
                            referência {anoPnp} — arquivo <code>EficienciaAcademica.csv</code>.
                          </ItemMemoria>
                          <ItemMemoria>
                            Concluídos {formatoNumero.format(calc.concluidos)} + Evadidos{" "}
                            {formatoNumero.format(calc.evadidos)} + Retidos {formatoNumero.format(calc.retidos)} (soma
                            de todos os câmpus da instituição) → C_ciclo{" "}
                            <strong>{formatoNumero.format(calc.conclusaoCiclo)}</strong>, Ev_ciclo{" "}
                            <strong>{formatoNumero.format(calc.evasaoCiclo)}</strong>, R_ciclo{" "}
                            <strong>{formatoNumero.format(calc.retencaoCiclo)}</strong>
                          </ItemMemoria>
                          <ItemMemoria>
                            IEA = C_ciclo + R_ciclo × (C_ciclo ÷ (C_ciclo + Ev_ciclo)) ={" "}
                            <strong>{formatoNumero.format(calc.eficienciaAcademica)}</strong>
                          </ItemMemoria>
                          <ItemMemoria>
                            Aproximação: a Portaria SETEC/MEC 646/2022 exclui cursos FIC do &quot;ciclo&quot;, mas o
                            CSV da PNP não distingue tipo de curso — essa agregação diverge do valor oficial em redes
                            com muitos câmpus (erro observado de até ~53pp em algumas instituições).
                          </ItemMemoria>
                        </ul>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        {linhasFiltradas.length} de {linhas.length} instituições — ano-base {ano}.
      </p>
    </div>
  );
}

function OrcamentoDistribuidoOficialTabela({ ano }: { ano: number }) {
  const [linhas, setLinhas] = useState<OrcamentoDistribuidoOficialResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    setCarregando(true);
    fetch(apiUrl(`/api/orcamento-distribuido-oficial?ano=${ano}`))
      .then((r) => (r.ok ? (r.json() as Promise<OrcamentoDistribuidoOficialResumo[]>) : []))
      .then(setLinhas)
      .catch(() => setLinhas([]))
      .finally(() => setCarregando(false));
  }, [ano]);

  const linhasFiltradas = useFiltro(linhas, busca, (l) => `${l.instituicaoNome} ${l.instituicaoSigla}`);

  if (carregando) return <p className="text-sm text-neutral-500 dark:text-neutral-400">Carregando...</p>;

  return (
    <div className="flex flex-col gap-3">
      <CaixaBusca busca={busca} onChange={setBusca} />
      <div className="max-h-[32rem] overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-neutral-50 text-left dark:bg-neutral-900">
            <tr>
              <th className="px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400">Sigla</th>
              <th className="px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400">Instituição</th>
              {CAMPO_ORCAMENTO_OFICIAL.map((c) => (
                <th key={c.chave} className="px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400">
                  {c.label}
                </th>
              ))}
              <th className="px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400">Origem custeio</th>
              <th className="px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400">Origem assistência</th>
            </tr>
          </thead>
          <tbody>
            {linhasFiltradas.map((l) => (
              <tr key={l.instituicaoId} className="border-t border-neutral-200 dark:border-neutral-800">
                <td className="px-3 py-2 text-neutral-600 dark:text-neutral-400">{l.instituicaoSigla}</td>
                <td className="px-3 py-2 text-neutral-900 dark:text-neutral-100">{l.instituicaoNome}</td>
                {CAMPO_ORCAMENTO_OFICIAL.map((c) => (
                  <td key={c.chave} className="px-3 py-2 text-neutral-900 dark:text-neutral-100">
                    {formatoNumero.format(l[c.chave])}
                  </td>
                ))}
                <td className="px-3 py-2">
                  <OrigemBadge origem={l.origemCusteio} />
                </td>
                <td className="px-3 py-2">
                  <OrigemBadge origem={l.origemAssistencia} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        {linhasFiltradas.length} de {linhas.length} instituições — ano-base {ano}. Publicado pela CONIF já com o
        complemento da trava de não-decréscimo embutido — este sistema não reimplementa esse algoritmo, então não há
        uma coluna calculada de comparação para estes dois valores.
      </p>
    </div>
  );
}

/**
 * Consulta somente-leitura dos dados anuais publicados pela CONIF (Matrícula Total equalizada, RAPP,
 * Eficiência Acadêmica oficial, Custeio/Assistência distribuídos oficiais) — mesmos dados de
 * /admin/dados-anuais, mas sem os controles de edição/import, e com a tag "Origem" (Planilha oficial
 * vs. Configurado à mão) por linha, para deixar claro de onde cada valor veio.
 */
export function DadosAnuaisConsultaPanel() {
  const [anosOrcamento, setAnosOrcamento] = useState<number[]>([]);
  const [ano, setAno] = useState<number | null>(null);

  useEffect(() => {
    fetch(apiUrl("/api/orcamentos-anuais"))
      .then((r) => (r.ok ? (r.json() as Promise<{ ano: number }[]>) : []))
      .then((lista) => {
        const anos = lista.map((o) => o.ano);
        setAnosOrcamento(anos);
        setAno((atual) => atual ?? anos[0] ?? new Date().getFullYear());
      })
      .catch(() => setAno((atual) => atual ?? new Date().getFullYear()));
  }, []);

  if (ano === null) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">Carregando...</p>;
  }

  const opcoesAno = anosOrcamento.includes(ano) ? anosOrcamento : [ano, ...anosOrcamento];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300" htmlFor="ano-dados-anuais-consulta">
          Ano-base
        </label>
        <select
          id="ano-dados-anuais-consulta"
          value={ano}
          onChange={(e) => setAno(Number(e.target.value))}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        >
          {opcoesAno.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Matrícula Total equalizada</h2>
        <MatriculaTotalEqualizadaTabela key={ano} ano={ano} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">RAP Presencial oficial (RAPP)</h2>
        <RappAnualTabela key={ano} ano={ano} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Eficiência Acadêmica oficial (Conclusão/Evasão/Retenção de Ciclo)
        </h2>
        <EficienciaAcademicaAnualTabela key={ano} ano={ano} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Custeio e Assistência Estudantil oficiais
        </h2>
        <OrcamentoDistribuidoOficialTabela key={ano} ano={ano} />
      </section>
    </div>
  );
}
