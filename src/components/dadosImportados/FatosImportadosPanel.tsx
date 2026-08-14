"use client";

import { useEffect, useMemo, useState } from "react";
import { ALL_FILE_TYPE_METADATA } from "@/ingestion/config/fileMetadata";
import type { PnpFileType } from "@/ingestion/config/fileTypes";
import { apiUrl } from "@/lib/basePath";
import type { FatoImportadoLinha, FatosImportadosResponse } from "@/app/api/fatos/route";

interface InstituicaoOpcao {
  id: number;
  sigla: string;
  nome: string;
}

interface UnidadeOpcao {
  id: number;
  nome: string;
}

const formatoNumero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 });

function formatarDimensoesExtra(dimensoesExtra: Record<string, unknown> | null): string {
  if (!dimensoesExtra) return "—";
  const entradas = Object.entries(dimensoesExtra).filter(([, valor]) => valor !== null && valor !== undefined && valor !== "");
  if (entradas.length === 0) return "—";
  return entradas.map(([chave, valor]) => `${chave}: ${valor}`).join(" · ");
}

export function FatosImportadosPanel() {
  const [fileType, setFileType] = useState<PnpFileType>("DADOS_GERAIS");
  const [anosDisponiveis, setAnosDisponiveis] = useState<number[]>([]);
  const [medidasDisponiveis, setMedidasDisponiveis] = useState<string[]>([]);
  const [instituicoes, setInstituicoes] = useState<InstituicaoOpcao[]>([]);
  const [unidades, setUnidades] = useState<UnidadeOpcao[]>([]);

  const [ano, setAno] = useState<string>("");
  const [instituicaoId, setInstituicaoId] = useState<string>("");
  const [unidadeId, setUnidadeId] = useState<string>("");
  const [medida, setMedida] = useState<string>("");
  const [page, setPage] = useState(1);

  const [resposta, setResposta] = useState<FatosImportadosResponse | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Instituições carregam uma única vez — não dependem do tipo de arquivo selecionado.
  useEffect(() => {
    fetch(apiUrl("/api/instituicoes"))
      .then((r) => (r.ok ? (r.json() as Promise<InstituicaoOpcao[]>) : []))
      .then(setInstituicoes)
      .catch(() => setInstituicoes([]));
  }, []);

  // Câmpus em cascata, escopados pela instituição selecionada.
  useEffect(() => {
    setUnidadeId("");
    if (!instituicaoId) {
      setUnidades([]);
      return;
    }
    fetch(apiUrl(`/api/instituicoes/${instituicaoId}/unidades`))
      .then((r) => (r.ok ? (r.json() as Promise<UnidadeOpcao[]>) : []))
      .then(setUnidades)
      .catch(() => setUnidades([]));
  }, [instituicaoId]);

  // Anos e medidas disponíveis dependem do tipo de arquivo — trocar o tipo reseta os dois filtros
  // e a paginação, porque um valor selecionado no tipo anterior pode não existir no novo.
  useEffect(() => {
    setAno("");
    setMedida("");
    setPage(1);
    fetch(apiUrl(`/api/fatos/anos?fileType=${fileType}`))
      .then((r) => (r.ok ? (r.json() as Promise<number[]>) : []))
      .then(setAnosDisponiveis)
      .catch(() => setAnosDisponiveis([]));
    fetch(apiUrl(`/api/fatos/medidas?fileType=${fileType}`))
      .then((r) => (r.ok ? (r.json() as Promise<string[]>) : []))
      .then(setMedidasDisponiveis)
      .catch(() => setMedidasDisponiveis([]));
  }, [fileType]);

  // Qualquer outro filtro muda os dados exibidos — volta para a página 1.
  useEffect(() => {
    setPage(1);
  }, [ano, instituicaoId, unidadeId, medida]);

  useEffect(() => {
    const params = new URLSearchParams({ fileType, page: String(page) });
    if (ano) params.set("ano", ano);
    if (instituicaoId) params.set("instituicaoId", instituicaoId);
    if (unidadeId) params.set("unidadeId", unidadeId);
    if (medida) params.set("medida", medida);

    let cancelado = false;
    setCarregando(true);
    setErro(null);
    fetch(apiUrl(`/api/fatos?${params.toString()}`))
      .then(async (r) => {
        if (!r.ok) {
          const corpo = (await r.json().catch(() => null)) as { errorMessage?: string } | null;
          throw new Error(corpo?.errorMessage ?? "Não foi possível carregar os dados importados.");
        }
        return r.json() as Promise<FatosImportadosResponse>;
      })
      .then((dados) => {
        if (!cancelado) setResposta(dados);
      })
      .catch((e: Error) => {
        if (!cancelado) setErro(e.message);
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [fileType, ano, instituicaoId, unidadeId, medida, page]);

  const totalPaginas = useMemo(
    () => (resposta ? Math.max(1, Math.ceil(resposta.total / resposta.pageSize)) : 1),
    [resposta],
  );

  const selectClass =
    "rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <select
          value={fileType}
          onChange={(e) => setFileType(e.target.value as PnpFileType)}
          className={selectClass}
        >
          {ALL_FILE_TYPE_METADATA.map((meta) => (
            <option key={meta.fileType} value={meta.fileType}>
              {meta.label}
            </option>
          ))}
        </select>

        <select value={ano} onChange={(e) => setAno(e.target.value)} className={selectClass}>
          <option value="">Todos os anos</option>
          {anosDisponiveis.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        <select value={instituicaoId} onChange={(e) => setInstituicaoId(e.target.value)} className={selectClass}>
          <option value="">Todas as instituições</option>
          {instituicoes.map((i) => (
            <option key={i.id} value={i.id}>
              {i.sigla} — {i.nome}
            </option>
          ))}
        </select>

        <select
          value={unidadeId}
          onChange={(e) => setUnidadeId(e.target.value)}
          className={selectClass}
          disabled={!instituicaoId}
        >
          <option value="">Todos os câmpus</option>
          {unidades.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
            </option>
          ))}
        </select>

        <select value={medida} onChange={(e) => setMedida(e.target.value)} className={selectClass}>
          <option value="">Todas as medidas</option>
          {medidasDisponiveis.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}

      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        {resposta ? `${resposta.total.toLocaleString("pt-BR")} linha(s) encontrada(s)` : carregando ? "Carregando..." : ""}
        {resposta && resposta.total > 0 && ` — página ${resposta.page} de ${totalPaginas}`}
      </p>

      <div className="max-h-[32rem] overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-neutral-50 text-left dark:bg-neutral-900">
            <tr>
              <th className="px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400">Ano</th>
              <th className="px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400">Instituição</th>
              <th className="px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400">Câmpus</th>
              <th className="px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400">Medida</th>
              <th className="px-3 py-2 text-right font-medium text-neutral-600 dark:text-neutral-400">Valor</th>
              <th className="px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400">Outras dimensões</th>
            </tr>
          </thead>
          <tbody>
            {(resposta?.rows ?? []).map((linha: FatoImportadoLinha) => (
              <tr key={linha.id} className="border-t border-neutral-200 dark:border-neutral-800">
                <td className="px-3 py-2 text-neutral-600 dark:text-neutral-400">{linha.ano}</td>
                <td className="px-3 py-2 text-neutral-900 dark:text-neutral-100">
                  {linha.instituicaoSigla} — {linha.instituicaoNome}
                </td>
                <td className="px-3 py-2 text-neutral-600 dark:text-neutral-400">{linha.unidadeNome ?? "—"}</td>
                <td className="px-3 py-2 text-neutral-600 dark:text-neutral-400">{linha.medida}</td>
                <td className="px-3 py-2 text-right text-neutral-900 dark:text-neutral-100">
                  {formatoNumero.format(linha.valor)}
                </td>
                <td className="px-3 py-2 text-xs text-neutral-500 dark:text-neutral-400">
                  {formatarDimensoesExtra(linha.dimensoesExtra)}
                </td>
              </tr>
            ))}
            {resposta && resposta.rows.length === 0 && !carregando && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-neutral-500 dark:text-neutral-400">
                  Nenhum dado encontrado para esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {resposta && resposta.total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-md border border-neutral-300 px-3 py-1.5 disabled:opacity-40 dark:border-neutral-700"
          >
            Anterior
          </button>
          <span className="text-neutral-600 dark:text-neutral-400">
            Página {page} de {totalPaginas}
          </span>
          <button
            type="button"
            disabled={page >= totalPaginas}
            onClick={() => setPage((p) => Math.min(totalPaginas, p + 1))}
            className="rounded-md border border-neutral-300 px-3 py-1.5 disabled:opacity-40 dark:border-neutral-700"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}
