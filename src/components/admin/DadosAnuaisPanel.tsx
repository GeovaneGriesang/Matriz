"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  importarMatriculaTotalEqualizadaAnualAction,
  salvarMatriculaTotalEqualizadaAnualAction,
  type LinhaMatriculaNaoImportada,
} from "@/server/actions/matriculaTotalEqualizadaAnual";
import { importarRappAnualAction, salvarRappAnualAction, type LinhaRappNaoImportada } from "@/server/actions/rappAnual";

interface MatriculaResumo {
  unidadeId: number;
  unidadeNome: string;
  instituicaoId: number;
  instituicaoSigla: string;
  matriculaTotalPresencialEqualizada: number;
  matriculaTotalEadEqualizada: number;
  matriculaTotalEadMoocEqualizada: number;
  matriculaTotalEadFpEqualizada: number;
}

interface RappResumo {
  instituicaoId: number;
  instituicaoSigla: string;
  instituicaoNome: string;
  rapp: number;
}

const CAMPO_MATRICULA = [
  { chave: "matriculaTotalPresencialEqualizada", label: "Presencial" },
  { chave: "matriculaTotalEadEqualizada", label: "EaD" },
  { chave: "matriculaTotalEadMoocEqualizada", label: "EaD MOOC" },
  { chave: "matriculaTotalEadFpEqualizada", label: "EaD FP" },
] as const;

const formatoNumero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 5 });

function ResultadoImport({
  resultado,
}: {
  resultado: { importadas: number; atualizadas: number; naoImportadas: { linha: number; motivo: string; detalhe: string }[] };
}) {
  const [expandido, setExpandido] = useState(false);
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-neutral-700 dark:text-neutral-300">
        {resultado.importadas} importada(s), {resultado.atualizadas} atualizada(s).
      </p>
      {resultado.naoImportadas.length > 0 && (
        <div className="mt-1">
          <button
            type="button"
            onClick={() => setExpandido((v) => !v)}
            className="font-medium text-amber-700 underline hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-300"
          >
            {resultado.naoImportadas.length} linha(s) não importada(s) — {expandido ? "ocultar" : "ver detalhe"}
          </button>
          {expandido && (
            <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
              {resultado.naoImportadas.map((n, i) => (
                <li key={i} className="text-neutral-600 dark:text-neutral-400">
                  Linha {n.linha}: {n.detalhe} ({n.motivo})
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function MatriculaTotalEqualizadaTabela({ ano }: { ano: number }) {
  const [linhas, setLinhas] = useState<MatriculaResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [valores, setValores] = useState<Record<number, Record<string, string>>>({});
  const [estadoPorId, setEstadoPorId] = useState<Record<number, "idle" | "salvando" | "erro">>({});
  const [importando, setImportando] = useState(false);
  const [resultadoImport, setResultadoImport] = useState<{
    importadas: number;
    atualizadas: number;
    naoImportadas: { linha: number; motivo: string; detalhe: string }[];
  } | null>(null);
  const inputArquivoRef = useRef<HTMLInputElement | null>(null);

  function carregar() {
    setCarregando(true);
    fetch(`/api/matricula-total-equalizada?ano=${ano}`)
      .then((r) => (r.ok ? (r.json() as Promise<MatriculaResumo[]>) : []))
      .then((lista) => {
        setLinhas(lista);
        setValores(
          Object.fromEntries(
            lista.map((l) => [
              l.unidadeId,
              Object.fromEntries(CAMPO_MATRICULA.map((c) => [c.chave, String(l[c.chave])])),
            ]),
          ),
        );
      })
      .catch(() => {
        // Falha pontual ao listar não deve travar a tela.
      })
      .finally(() => setCarregando(false));
  }

  useEffect(carregar, [ano]);

  const linhasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return linhas;
    return linhas.filter(
      (l) => l.unidadeNome.toLowerCase().includes(termo) || l.instituicaoSigla.toLowerCase().includes(termo),
    );
  }, [linhas, busca]);

  async function salvarLinha(unidadeId: number) {
    setEstadoPorId((atual) => ({ ...atual, [unidadeId]: "salvando" }));
    try {
      const formData = new FormData();
      formData.set("unidadeId", String(unidadeId));
      formData.set("ano", String(ano));
      for (const campo of CAMPO_MATRICULA) {
        formData.set(campo.chave, valores[unidadeId]?.[campo.chave] ?? "0");
      }
      const resultado = await salvarMatriculaTotalEqualizadaAnualAction(formData);
      if (!resultado.ok) throw new Error(resultado.errorMessage ?? "Não foi possível salvar.");
      setEstadoPorId((atual) => ({ ...atual, [unidadeId]: "idle" }));
    } catch {
      setEstadoPorId((atual) => ({ ...atual, [unidadeId]: "erro" }));
    }
  }

  async function importarArquivo(arquivo: File) {
    setImportando(true);
    setResultadoImport(null);
    try {
      const formData = new FormData();
      formData.set("ano", String(ano));
      formData.set("arquivo", arquivo);
      const resultado = await importarMatriculaTotalEqualizadaAnualAction(formData);
      if (!resultado.ok) throw new Error(resultado.errorMessage ?? "Falha ao importar.");
      setResultadoImport({
        importadas: resultado.importadas ?? 0,
        atualizadas: resultado.atualizadas ?? 0,
        naoImportadas: (resultado.naoImportadas ?? []).map((n: LinhaMatriculaNaoImportada) => ({
          linha: n.linha,
          motivo: n.motivo,
          detalhe:
            `${n.instituicao} / ${n.campus}` +
            (n.candidatos ? ` — candidatos: ${n.candidatos.map((c) => `#${c.id} ${c.nome}`).join(", ")}` : ""),
        })),
      });
      carregar();
    } catch (error) {
      setResultadoImport({ importadas: 0, atualizadas: 0, naoImportadas: [{ linha: 0, motivo: "erro", detalhe: (error as Error).message }] });
    } finally {
      setImportando(false);
      if (inputArquivoRef.current) inputArquivoRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Filtrar por câmpus ou sigla da instituição..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="min-w-64 flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        />
        <label className="cursor-pointer rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900">
          {importando ? "Importando..." : "Importar CSV"}
          <input
            ref={inputArquivoRef}
            type="file"
            accept=".csv"
            className="hidden"
            disabled={importando}
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              if (arquivo) importarArquivo(arquivo);
            }}
          />
        </label>
      </div>
      {resultadoImport && <ResultadoImport resultado={resultadoImport} />}
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        {linhasFiltradas.length} de {linhas.length} câmpus — ano-base {ano}.
      </p>

      {carregando ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Carregando...</p>
      ) : (
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
                <th className="px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400"></th>
              </tr>
            </thead>
            <tbody>
              {linhasFiltradas.map((l) => {
                const estado = estadoPorId[l.unidadeId] ?? "idle";
                return (
                  <tr key={l.unidadeId} className="border-t border-neutral-200 dark:border-neutral-800">
                    <td className="px-3 py-2 text-neutral-600 dark:text-neutral-400">{l.instituicaoSigla}</td>
                    <td className="px-3 py-2 text-neutral-900 dark:text-neutral-100">{l.unidadeNome}</td>
                    {CAMPO_MATRICULA.map((c) => {
                      const valorAtual = valores[l.unidadeId]?.[c.chave] ?? "0";
                      return (
                        <td key={c.chave} className="px-3 py-2">
                          <input
                            type="number"
                            step="0.00001"
                            value={valorAtual}
                            onChange={(e) =>
                              setValores((atual) => ({
                                ...atual,
                                [l.unidadeId]: { ...atual[l.unidadeId], [c.chave]: e.target.value },
                              }))
                            }
                            onBlur={() => {
                              if (valorAtual !== String(l[c.chave])) salvarLinha(l.unidadeId);
                            }}
                            className="w-24 rounded-md border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                          />
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-xs">
                      {estado === "salvando" && <span className="text-neutral-500 dark:text-neutral-400">Salvando...</span>}
                      {estado === "erro" && <span className="text-red-600 dark:text-red-400">Erro ao salvar</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RappAnualTabela({ ano }: { ano: number }) {
  const [linhas, setLinhas] = useState<RappResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [valores, setValores] = useState<Record<number, string>>({});
  const [estadoPorId, setEstadoPorId] = useState<Record<number, "idle" | "salvando" | "erro">>({});
  const [importando, setImportando] = useState(false);
  const [resultadoImport, setResultadoImport] = useState<{
    importadas: number;
    atualizadas: number;
    naoImportadas: { linha: number; motivo: string; detalhe: string }[];
  } | null>(null);
  const inputArquivoRef = useRef<HTMLInputElement | null>(null);

  function carregar() {
    setCarregando(true);
    fetch(`/api/rapp-anual?ano=${ano}`)
      .then((r) => (r.ok ? (r.json() as Promise<RappResumo[]>) : []))
      .then((lista) => {
        setLinhas(lista);
        setValores(Object.fromEntries(lista.map((l) => [l.instituicaoId, String(l.rapp)])));
      })
      .catch(() => {
        // Falha pontual ao listar não deve travar a tela.
      })
      .finally(() => setCarregando(false));
  }

  useEffect(carregar, [ano]);

  const linhasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return linhas;
    return linhas.filter(
      (l) => l.instituicaoNome.toLowerCase().includes(termo) || l.instituicaoSigla.toLowerCase().includes(termo),
    );
  }, [linhas, busca]);

  async function salvarLinha(instituicaoId: number) {
    setEstadoPorId((atual) => ({ ...atual, [instituicaoId]: "salvando" }));
    try {
      const formData = new FormData();
      formData.set("instituicaoId", String(instituicaoId));
      formData.set("ano", String(ano));
      formData.set("rapp", valores[instituicaoId] ?? "0");
      const resultado = await salvarRappAnualAction(formData);
      if (!resultado.ok) throw new Error(resultado.errorMessage ?? "Não foi possível salvar.");
      setEstadoPorId((atual) => ({ ...atual, [instituicaoId]: "idle" }));
    } catch {
      setEstadoPorId((atual) => ({ ...atual, [instituicaoId]: "erro" }));
    }
  }

  async function importarArquivo(arquivo: File) {
    setImportando(true);
    setResultadoImport(null);
    try {
      const formData = new FormData();
      formData.set("ano", String(ano));
      formData.set("arquivo", arquivo);
      const resultado = await importarRappAnualAction(formData);
      if (!resultado.ok) throw new Error(resultado.errorMessage ?? "Falha ao importar.");
      setResultadoImport({
        importadas: resultado.importadas ?? 0,
        atualizadas: resultado.atualizadas ?? 0,
        naoImportadas: (resultado.naoImportadas ?? []).map((n: LinhaRappNaoImportada) => ({
          linha: n.linha,
          motivo: n.motivo,
          detalhe: n.sigla + (n.candidatos ? ` — candidatos: ${n.candidatos.map((c) => `#${c.id} ${c.nome}`).join(", ")}` : ""),
        })),
      });
      carregar();
    } catch (error) {
      setResultadoImport({ importadas: 0, atualizadas: 0, naoImportadas: [{ linha: 0, motivo: "erro", detalhe: (error as Error).message }] });
    } finally {
      setImportando(false);
      if (inputArquivoRef.current) inputArquivoRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Filtrar por instituição ou sigla..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="min-w-64 flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        />
        <label className="cursor-pointer rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900">
          {importando ? "Importando..." : "Importar CSV"}
          <input
            ref={inputArquivoRef}
            type="file"
            accept=".csv"
            className="hidden"
            disabled={importando}
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              if (arquivo) importarArquivo(arquivo);
            }}
          />
        </label>
      </div>
      {resultadoImport && <ResultadoImport resultado={resultadoImport} />}
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        {linhasFiltradas.length} de {linhas.length} instituições — ano-base {ano}.
      </p>

      {carregando ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Carregando...</p>
      ) : (
        <div className="max-h-[24rem] overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-neutral-50 text-left dark:bg-neutral-900">
              <tr>
                <th className="px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400">Sigla</th>
                <th className="px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400">Instituição</th>
                <th className="px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400">RAPP</th>
                <th className="px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400"></th>
              </tr>
            </thead>
            <tbody>
              {linhasFiltradas.map((l) => {
                const estado = estadoPorId[l.instituicaoId] ?? "idle";
                const valorAtual = valores[l.instituicaoId] ?? "0";
                return (
                  <tr key={l.instituicaoId} className="border-t border-neutral-200 dark:border-neutral-800">
                    <td className="px-3 py-2 text-neutral-600 dark:text-neutral-400">{l.instituicaoSigla}</td>
                    <td className="px-3 py-2 text-neutral-900 dark:text-neutral-100">{l.instituicaoNome}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.000001"
                        value={valorAtual}
                        onChange={(e) =>
                          setValores((atual) => ({ ...atual, [l.instituicaoId]: e.target.value }))
                        }
                        onBlur={() => {
                          if (valorAtual !== String(l.rapp)) salvarLinha(l.instituicaoId);
                        }}
                        className="w-32 rounded-md border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                      />
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {estado === "salvando" && <span className="text-neutral-500 dark:text-neutral-400">Salvando...</span>}
                      {estado === "erro" && <span className="text-red-600 dark:text-red-400">Erro ao salvar</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function DadosAnuaisPanel() {
  const [anosOrcamento, setAnosOrcamento] = useState<number[]>([]);
  const [ano, setAno] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/orcamentos-anuais")
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
        <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300" htmlFor="ano-dados-anuais">
          Ano-base
        </label>
        <select
          id="ano-dados-anuais"
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
    </div>
  );
}
