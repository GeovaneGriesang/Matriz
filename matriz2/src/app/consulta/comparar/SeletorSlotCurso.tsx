"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ehInstituicaoDestaque } from "@/lib/destaque";

export interface CampusOpcao {
  id: number;
  nome: string;
  instituicaoSigla: string;
}

export interface CursoOpcao {
  id: number;
  curso: string;
  valor: number;
  peso: number | null;
  repasse: string;
  /** Início do ciclo (ISO), para distinguir turmas do mesmo curso na lista. */
  inicio: string | null;
  /** Modalidade (técnico integrado, Proeja, superior...) e tipo do curso (bacharelado, licenciatura...). */
  modalidade: string;
  tipoCurso: string;
}

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function mesAno(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `, início ${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
}

/**
 * Um "slot" de comparação, em três passos: a instituição (o IFSul sempre primeiro), depois o câmpus dela e, dentro do
 * câmpus, o curso numa lista que já mostra tudo e pode ser filtrada digitando. Navega direto (router.push): uma função
 * não atravessaria a fronteira de Server para Client Component, então quem monta a URL de destino é este componente, a
 * partir só de dado simples (`paramsAtuais`).
 */
export function SeletorSlotCurso({
  indice,
  ehPrincipal,
  instituicoes,
  campi,
  instituicaoEscolhida,
  campusEscolhido,
  campusTravado,
  cursos,
  cursoEscolhido,
  paramsAtuais,
  podeRemover,
  aviso,
}: {
  indice: number;
  ehPrincipal: boolean;
  instituicoes: string[];
  campi: CampusOpcao[];
  instituicaoEscolhida: string;
  campusEscolhido: number;
  campusTravado: boolean;
  cursos: CursoOpcao[];
  cursoEscolhido: number | null;
  paramsAtuais: Record<string, string>;
  podeRemover: boolean;
  aviso?: string;
}) {
  const router = useRouter();
  const [filtro, setFiltro] = useState("");

  function navegar(mudanca: Record<string, string | undefined>) {
    const q = new URLSearchParams();
    for (const [chave, valor] of Object.entries({ ...paramsAtuais, ...mudanca })) if (valor !== undefined) q.set(chave, valor);
    // scroll: false mantém a página onde está, em vez de voltar ao topo a cada escolha.
    router.push(`/consulta/comparar?${q.toString()}`, { scroll: false });
  }

  const campiDaInstituicao = campi.filter((c) => c.instituicaoSigla === instituicaoEscolhida);
  const filtroNormalizado = normalizar(filtro);
  const cursosVisiveis = cursos.filter((c) => !filtroNormalizado || normalizar(c.curso).includes(filtroNormalizado) || c.id === cursoEscolhido);
  const classeSelect = "rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";

  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border p-4 ${
        ehPrincipal ? "border-if-green bg-if-green/5 ring-1 ring-if-green/40" : "border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
          {ehPrincipal ? "Curso principal" : `Curso ${indice}`}
          {ehPrincipal && <span className="rounded-full bg-if-green px-2 py-0.5 text-[10px] font-semibold text-white">comparado aos outros</span>}
        </span>
        {podeRemover && (
          <button type="button" onClick={() => navegar({ [`campus${indice}`]: undefined, [`curso${indice}`]: undefined })} className="text-xs text-neutral-500 underline hover:text-if-red">
            remover
          </button>
        )}
      </div>

      <label className="flex flex-col gap-1 text-xs text-neutral-500">
        1. Instituição
        <select
          value={instituicaoEscolhida}
          disabled={campusTravado}
          onChange={(e) => {
            const primeiro = campi.find((c) => c.instituicaoSigla === e.target.value);
            if (primeiro) navegar({ [`campus${indice}`]: String(primeiro.id), [`curso${indice}`]: undefined });
          }}
          className={classeSelect}
        >
          {instituicoes.map((sigla) => (
            <option key={sigla} value={sigla}>
              {ehInstituicaoDestaque(sigla) ? "★ " : ""}
              {sigla}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-neutral-500">
        2. Câmpus {campusTravado && "(o mesmo do principal)"}
        <select value={campusEscolhido} disabled={campusTravado} onChange={(e) => navegar({ [`campus${indice}`]: e.target.value, [`curso${indice}`]: undefined })} className={classeSelect}>
          {campiDaInstituicao.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-1 text-xs text-neutral-500">
        3. Curso ({cursos.length} {cursos.length === 1 ? "opção" : "opções"})
        <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="digite para filtrar a lista" className={classeSelect} aria-label={`Filtrar os cursos do slot ${indice}`} />
        <select
          size={Math.min(7, Math.max(3, cursosVisiveis.length))}
          value={cursoEscolhido ?? ""}
          onChange={(e) => navegar({ [`curso${indice}`]: e.target.value })}
          className={classeSelect}
          // A altura e a letra vêm dos ajustes da tela (AjustesDaSelecao); sem eles, valem estes padrões.
          style={{ height: "var(--lista-altura, 11rem)", fontSize: "var(--lista-fonte, 14px)" }}
          aria-label={`Curso do slot ${indice}`}
        >
          {cursosVisiveis.map((c) => (
            <option key={c.id} value={c.id}>
              {c.curso}
              {c.modalidade ? ` [${c.modalidade}${c.modalidade === "Superior" && c.tipoCurso ? `, ${c.tipoCurso}` : ""}]` : ""}
              {c.peso !== null ? `, peso ${c.peso.toString().replace(".", ",")}` : ""}
              {c.repasse !== "PRESENCIAL" ? `, ${c.repasse.replace("_", " ")}` : ""}
              {mesAno(c.inicio)} ({reais.format(c.valor)})
            </option>
          ))}
        </select>
        {cursosVisiveis.length === 0 && <span>Nenhum curso com esse nome.</span>}
        {aviso && <span className="text-amber-700 dark:text-amber-400">{aviso}</span>}
      </div>
    </div>
  );
}
